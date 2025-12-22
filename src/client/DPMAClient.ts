/**
 * DPMAClient - Main orchestrator for DPMA trademark registration
 *
 * This is a refactored version that delegates to specialized modules:
 * - http/ - HTTP communication and AJAX helpers
 * - session/ - Session state and token management
 * - steps/ - Individual form steps (1-8)
 * - services/ - Post-submission services (Versand, Documents)
 * - utils/ - Utilities (logging, mappings)
 */

import {
  TrademarkRegistrationRequest,
  TrademarkRegistrationResult,
  PaymentMethod,
} from '../types/dpma';

// HTTP layer
import { DPMAHttpClient, BROWSER_HEADERS, EDITOR_PATH, BASE_URL } from './http';

// Session management
import { SessionManager, TokenExtractor } from './session';

// Form steps
import {
  Step1Applicant,
  Step2Lawyer,
  Step3DeliveryAddress,
  Step4Trademark,
  Step5NiceClasses,
  Step6Options,
  Step7Payment,
  Step8Final,
  StepDependencies,
} from './steps';

// Services
import { VersandService, DocumentService } from './services';

// Utilities
import { DebugLogger } from './utils';

export class DPMAClient {
  // Core dependencies
  private http: DPMAHttpClient;
  private session: SessionManager;
  private tokenExtractor: TokenExtractor;
  private logger: DebugLogger;

  // Steps
  private step1: Step1Applicant;
  private step2: Step2Lawyer;
  private step3: Step3DeliveryAddress;
  private step4: Step4Trademark;
  private step5: Step5NiceClasses;
  private step6: Step6Options;
  private step7: Step7Payment;
  private step8: Step8Final;

  // Services
  private versand: VersandService;
  private documents: DocumentService;

  // Configuration
  private baseDir: string;
  private receiptsDir: string;

  constructor(options: { debug?: boolean; baseDir?: string } = {}) {
    const debug = options.debug ?? false;
    this.baseDir = options.baseDir ?? process.cwd();
    this.receiptsDir = `${this.baseDir}/receipts`;

    // Initialize core dependencies
    this.logger = new DebugLogger({
      enabled: debug,
      debugDir: `${this.baseDir}/debug`,
    });
    this.http = new DPMAHttpClient({ debug });
    this.session = new SessionManager();
    this.tokenExtractor = new TokenExtractor(this.logger);

    // Create step dependencies
    const deps: StepDependencies = {
      http: this.http,
      session: this.session,
      tokenExtractor: this.tokenExtractor,
      logger: this.logger,
    };

    // Initialize steps
    this.step1 = new Step1Applicant(deps);
    this.step2 = new Step2Lawyer(deps);
    this.step3 = new Step3DeliveryAddress(deps);
    this.step4 = new Step4Trademark(deps);
    this.step5 = new Step5NiceClasses(deps);
    this.step6 = new Step6Options(deps);
    this.step7 = new Step7Payment(deps);
    this.step8 = new Step8Final(deps);

    // Initialize services
    this.versand = new VersandService(this.http, this.logger);
    this.documents = new DocumentService(this.http, this.logger, this.receiptsDir);
  }

  /**
   * Initialize a new session with DPMA
   * This performs the initial navigation to get cookies and tokens
   */
  async initSession(): Promise<void> {
    this.logger.log('Initializing session...');

    // Step 1: Load main page
    await this.http.get(`${EDITOR_PATH}/index.xhtml`, {
      headers: BROWSER_HEADERS,
    });
    this.logger.log('Loaded main page');

    // Step 2: Navigate to trademark start page
    let jfwid: string | null = null;

    const startPageResponse = await this.http.get(`${EDITOR_PATH}/w7005-start.xhtml`, {
      headers: {
        ...BROWSER_HEADERS,
        'Referer': `${BASE_URL}${EDITOR_PATH}/index.xhtml`,
      },
      maxRedirects: 0,
      validateStatus: (status: number) => status === 200 || status === 302,
    });

    // Check if we got a redirect
    if (startPageResponse.status === 302) {
      const location = startPageResponse.headers.location as string;
      this.logger.log('Redirect received from start page', location);

      const jfwidMatch = location.match(/jfwid=([^&:]+(?::\d+)?)/);
      if (jfwidMatch) {
        jfwid = jfwidMatch[1];
        this.logger.log('Extracted jfwid from redirect:', jfwid);

        // Follow the redirect manually
        await this.http.get(location.startsWith('http') ? location : `${BASE_URL}${location}`, {
          headers: {
            ...BROWSER_HEADERS,
            'Referer': `${BASE_URL}${EDITOR_PATH}/index.xhtml`,
          },
        });
      }
    }

    // If no redirect, try to extract from HTML content
    if (!jfwid) {
      const htmlContent = startPageResponse.data as string;
      const jfwidInHtml = htmlContent.match(/jfwid[=:]([^&"'\s]+)/);
      if (jfwidInHtml) {
        jfwid = jfwidInHtml[1];
        this.logger.log('Extracted jfwid from HTML:', jfwid);
      }
    }

    if (!jfwid) {
      throw new Error('Failed to extract jfwid from session initialization');
    }

    this.logger.log(`Extracted jfwid: ${jfwid}`);

    // Step 3: Start the trademark application (navigate to web form)
    const formUrl = `${EDITOR_PATH}/w7005/w7005web.xhtml?jftfdi=&jffi=w7005&jfwid=${jfwid}`;
    const formResponse = await this.http.get(formUrl, {
      headers: {
        ...BROWSER_HEADERS,
        'Referer': `${BASE_URL}${EDITOR_PATH}/w7005-start.xhtml?jfwid=${jfwid}`,
      },
    });

    const formHtml = formResponse.data as string;
    this.logger.log('Form page received, length:', formHtml.length);

    // Check if we got the actual form page
    if (formHtml.includes('editor-form') || formHtml.includes('daf-applicant')) {
      this.logger.log('Form page contains expected elements');
    } else {
      this.logger.log('WARNING: Form page might not be the expected page');
      this.logger.log('Page title:', formHtml.match(/<title>([^<]+)<\/title>/)?.[1] || 'unknown');
    }

    // Save HTML for debugging
    this.logger.saveFile('form.html', formHtml);

    // Extract tokens from the form page
    const tokens = this.tokenExtractor.extractTokens(formHtml, jfwid);
    this.logger.log('Extracted tokens', {
      viewState: tokens.viewState.substring(0, 20) + '...',
      clientWindow: tokens.clientWindow,
      nonce: tokens.primefacesNonce ? tokens.primefacesNonce.substring(0, 10) + '...' : '(empty)',
    });

    // Initialize session state
    this.session.initialize(jfwid, tokens);

    this.logger.log('Session initialized successfully');
  }

  /**
   * Execute the complete trademark registration process
   */
  async registerTrademark(request: TrademarkRegistrationRequest): Promise<TrademarkRegistrationResult> {
    try {
      // Initialize session
      await this.initSession();

      // Step 1: Applicant
      await this.step1.execute(request);

      // Step 2: Skip Lawyer
      await this.step2.execute(request);

      // Step 3: Delivery Address
      await this.step3.execute(request);

      // Step 4: Trademark
      await this.step4.execute(request);

      // Step 5: Nice Classes
      await this.step5.execute(request);

      // Step 6: Options
      await this.step6.execute(request);

      // Step 7: Payment
      await this.step7.execute(request);

      // Step 8: Final Submit
      const encryptedTransactionId = await this.step8.execute(request);

      // Complete via Versand service
      const versandResponse = await this.versand.complete(encryptedTransactionId);

      // Download documents (ZIP archive)
      const { zipData, documents } = await this.documents.download(encryptedTransactionId);

      // Save the complete ZIP archive
      let receiptFilePath: string | undefined;
      if (zipData.length > 0) {
        receiptFilePath = this.documents.saveZip(versandResponse.akz, zipData);
        this.logger.log(`ZIP archive saved to: ${receiptFilePath}`);
      }

      // Build success response
      return {
        success: true,
        aktenzeichen: versandResponse.akz,
        drn: versandResponse.drn,
        transactionId: versandResponse.transactionId,
        submissionTime: versandResponse.creationTime,
        fees: [
          {
            code: '331000',
            description: 'Anmeldeverfahren - bei elektronischer Anmeldung',
            amount: 290.00,
          },
        ],
        payment: {
          method: request.paymentMethod,
          totalAmount: 290.00,
          currency: 'EUR',
          bankDetails: request.paymentMethod === PaymentMethod.BANK_TRANSFER ? {
            recipient: 'Bundeskasse',
            iban: 'DE84 7000 0000 0070 0010 54',
            bic: 'MARKDEF1700',
            reference: versandResponse.akz,
          } : undefined,
        },
        receiptDocuments: documents,
        receiptFilePath,
      };

    } catch (error: any) {
      this.logger.log('Registration failed', error);

      return {
        success: false,
        errorCode: error.code || 'UNKNOWN_ERROR',
        errorMessage: error.message || 'An unknown error occurred',
        failedAtStep: this.session.isInitialized() ? this.session.getStepCounter() : undefined,
      };
    }
  }

  /**
   * Save a receipt document to the receipts folder
   * (Public method for backward compatibility)
   */
  saveReceipt(aktenzeichen: string, document: { filename: string; data: Buffer; mimeType: string }): string {
    return this.documents.saveDocument(aktenzeichen, document);
  }

  // ============================================================================
  // PUBLIC STEP METHODS (for testing and backward compatibility)
  // ============================================================================

  /**
   * Step 1: Submit applicant information
   */
  async submitApplicant(request: TrademarkRegistrationRequest): Promise<void> {
    await this.step1.execute(request);
  }

  /**
   * Step 2: Skip lawyer/representative
   */
  async skipLawyer(): Promise<void> {
    await this.step2.execute({} as TrademarkRegistrationRequest);
  }

  /**
   * Step 3: Submit delivery address
   */
  async submitDeliveryAddress(request: TrademarkRegistrationRequest): Promise<void> {
    await this.step3.execute(request);
  }

  /**
   * Step 4: Submit trademark
   */
  async submitTrademark(request: TrademarkRegistrationRequest): Promise<void> {
    await this.step4.execute(request);
  }

  /**
   * Step 5: Submit Nice classes
   */
  async submitNiceClasses(request: TrademarkRegistrationRequest): Promise<void> {
    await this.step5.execute(request);
  }

  /**
   * Step 6: Submit additional options
   */
  async submitOptions(request: TrademarkRegistrationRequest): Promise<void> {
    await this.step6.execute(request);
  }

  /**
   * Step 7: Submit payment method
   */
  async submitPayment(request: TrademarkRegistrationRequest): Promise<void> {
    await this.step7.execute(request);
  }

  /**
   * Step 8: Final submission (returns encrypted transaction ID)
   */
  async submitFinal(request: TrademarkRegistrationRequest): Promise<string> {
    return await this.step8.execute(request) as string;
  }

  /**
   * Complete via Versand service
   */
  async completeVersand(encryptedTransactionId: string): Promise<import('../types/dpma').VersandResponse> {
    return this.versand.complete(encryptedTransactionId);
  }

  /**
   * Download documents
   */
  async downloadDocuments(encryptedTransactionId: string): Promise<{
    zipData: Buffer;
    documents: import('../types/dpma').DownloadedDocument[];
  }> {
    return this.documents.download(encryptedTransactionId);
  }
}
