/**
 * DPMA Client - Handles all HTTP communication with the DPMA website
 * Manages session state, form submissions, and document downloads
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import FormData from 'form-data';
import AdmZip from 'adm-zip';

import {
  DpmaSession,
  JsfTokens,
  TrademarkRegistrationRequest,
  TrademarkRegistrationResult,
  VersandResponse,
  DownloadedDocument,
  ApplicantType,
  TrademarkType,
  PaymentMethod,
  SanctionDeclaration,
  DPMA_VIEW_IDS,
  NaturalPersonApplicant,
  LegalEntityApplicant,
} from '../types/dpma';

/** Base URLs */
const BASE_URL = 'https://direkt.dpma.de';
const EDITOR_PATH = '/DpmaDirektWebEditoren';
const VERSAND_PATH = '/DpmaDirektWebVersand';

/** Request headers for AJAX calls */
const AJAX_HEADERS = {
  'faces-request': 'partial/ajax',
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'application/xml, text/xml, */*; q=0.01',
};

/** Standard browser headers */
const BROWSER_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
};

export class DPMAClient {
  private client: AxiosInstance;
  private cookieJar: CookieJar;
  private session: DpmaSession | null = null;
  private debug: boolean;
  private lastResponseHtml: string = ''; // Store last response for dynamic field extraction
  private baseDir: string;
  private debugDir: string;
  private receiptsDir: string;

  constructor(options: { debug?: boolean; baseDir?: string } = {}) {
    this.debug = options.debug ?? false;
    this.baseDir = options.baseDir ?? process.cwd();
    this.debugDir = `${this.baseDir}/debug`;
    this.receiptsDir = `${this.baseDir}/receipts`;
    this.cookieJar = new CookieJar();

    // Create axios instance with cookie support
    this.client = wrapper(axios.create({
      baseURL: BASE_URL,
      jar: this.cookieJar,
      withCredentials: true,
      headers: BROWSER_HEADERS,
      maxRedirects: 0, // Handle redirects manually for better control
      validateStatus: (status) => status >= 200 && status < 400,
    }));
  }

  private log(message: string, data?: unknown): void {
    if (this.debug) {
      console.log(`[DPMAClient] ${message}`, data ?? '');
    }
  }

  /**
   * Ensure a directory exists, creating it if necessary
   */
  private ensureDir(dir: string): void {
    const fs = require('fs');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Save a debug file (only if debug mode is enabled)
   */
  private saveDebugFile(filename: string, content: string | Buffer): void {
    if (!this.debug) return;
    try {
      const fs = require('fs');
      this.ensureDir(this.debugDir);
      fs.writeFileSync(`${this.debugDir}/${filename}`, content);
      this.log(`Saved debug file: ${filename}`);
    } catch (e) { /* ignore */ }
  }

  /**
   * Save receipt document to receipts folder
   * Returns the file path where the receipt was saved
   */
  saveReceipt(aktenzeichen: string, document: DownloadedDocument): string {
    const fs = require('fs');
    this.ensureDir(this.receiptsDir);

    // Create filename from aktenzeichen (sanitize for filesystem)
    const safeAkz = aktenzeichen.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${safeAkz}_${document.filename}`;
    const filepath = `${this.receiptsDir}/${filename}`;

    fs.writeFileSync(filepath, document.data);
    this.log(`Saved receipt: ${filepath}`);

    return filepath;
  }

  /**
   * Extract JSF tokens from HTML response
   */
  private extractTokens(html: string, jfwidFallback?: string): JsfTokens {
    const $ = cheerio.load(html);

    // Extract ViewState - try multiple possible selectors
    let viewState = $('input[name="jakarta.faces.ViewState"]').val() as string;
    if (!viewState) {
      viewState = $('input[id$="ViewState"]').val() as string;
    }
    if (!viewState) {
      // Try to find in script tags or as data attribute
      const match = html.match(/jakarta\.faces\.ViewState['"]\s*(?:value|:)\s*['"]([^'"]+)/);
      if (match) {
        viewState = match[1];
      }
    }
    if (!viewState) {
      this.log('HTML content (first 2000 chars):', html.substring(0, 2000));
      throw new Error('Failed to extract jakarta.faces.ViewState from HTML');
    }

    // Extract ClientWindow (from hidden input or URL)
    // Note: ClientWindow INCLUDES the counter suffix (e.g., "uuid:0")
    let clientWindow = $('input[name="jakarta.faces.ClientWindow"]').val() as string;
    if (!clientWindow) {
      // Try data attribute on form
      clientWindow = $('form').attr('data-client-window') as string;
    }
    if (!clientWindow && jfwidFallback) {
      // Use fallback - include :0 if not already present
      clientWindow = jfwidFallback.includes(':') ? jfwidFallback : `${jfwidFallback}:0`;
    }
    if (!clientWindow && this.session?.jfwid) {
      // session.jfwid is base jfwid, add :0 for initial form
      clientWindow = `${this.session.jfwid}:0`;
    }
    if (!clientWindow) {
      throw new Error('Failed to extract jakarta.faces.ClientWindow');
    }

    // Extract PrimeFaces nonce - the nonce is added dynamically by JavaScript
    // It's passed to PrimeFaces.csp.init('...') in a script tag
    let primefacesNonce = '';

    // Method 1: Extract from PrimeFaces.csp.init() call
    const cspInitMatch = html.match(/PrimeFaces\.csp\.init\(['"]([^'"]+)['"]\)/);
    if (cspInitMatch) {
      primefacesNonce = cspInitMatch[1];
      this.log('Extracted nonce from PrimeFaces.csp.init():', primefacesNonce.substring(0, 20) + '...');
    }

    // Method 2: Try from hidden input (in case page structure changes)
    if (!primefacesNonce) {
      primefacesNonce = $('input[name="primefaces.nonce"]').val() as string || '';
    }

    // Method 3: Extract from script tag nonce attribute
    if (!primefacesNonce) {
      const scriptNonceMatch = html.match(/<script[^>]+nonce=["']([^"']+)["']/);
      if (scriptNonceMatch) {
        primefacesNonce = scriptNonceMatch[1];
        this.log('Extracted nonce from script tag attribute:', primefacesNonce.substring(0, 20) + '...');
      }
    }

    if (!primefacesNonce) {
      this.log('WARNING: primefaces.nonce not found in HTML');
      primefacesNonce = '';
    }

    return { viewState, clientWindow, primefacesNonce };
  }

  /**
   * Extract jfwid from URL or response
   */
  private extractJfwid(url: string): string {
    const match = url.match(/jfwid=([^&:]+(?::\d+)?)/);
    if (!match) {
      throw new Error(`Failed to extract jfwid from URL: ${url}`);
    }
    return match[1];
  }

  /**
   * Build the form URL with current session parameters
   * The jfwid in the URL must match the jakarta.faces.ClientWindow value
   */
  private buildFormUrl(): string {
    if (!this.session) {
      throw new Error('Session not initialized');
    }
    // Use the ClientWindow value which includes the correct counter suffix
    // The URL jfwid must match jakarta.faces.ClientWindow in the form data
    const clientWindow = this.session.tokens.clientWindow;
    return `${EDITOR_PATH}/w7005/w7005web.xhtml?jftfdi=&jffi=w7005&jfwid=${clientWindow}`;
  }

  /**
   * Create multipart form data with standard AJAX fields (for file uploads)
   */
  private createFormData(fields: Record<string, string>): FormData {
    const form = new FormData();

    // Add all fields
    for (const [key, value] of Object.entries(fields)) {
      form.append(key, value);
    }

    return form;
  }

  /**
   * Create URL-encoded body for form submissions (properly handles UTF-8)
   */
  private createUrlEncodedBody(fields: Record<string, string>): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(fields)) {
      params.append(key, value);
    }
    return params.toString();
  }

  /**
   * Add standard AJAX navigation fields to form data
   */
  private addNavigationFields(
    fields: Record<string, string>,
    dpmaViewId: string
  ): Record<string, string> {
    if (!this.session) {
      throw new Error('Session not initialized');
    }

    return {
      ...fields,
      'jakarta.faces.partial.ajax': 'true',
      'jakarta.faces.source': 'cmd-link-next',
      'jakarta.faces.partial.execute': 'editor-form',
      'jakarta.faces.partial.render': 'editor-form',
      'cmd-link-next': 'cmd-link-next',
      'dpmaViewId': dpmaViewId,
      'dpmaViewCheck': 'true',
      'editor-form': 'editor-form',
      'jakarta.faces.ViewState': this.session.tokens.viewState,
      'jakarta.faces.ClientWindow': this.session.tokens.clientWindow,
      'primefaces.nonce': this.session.tokens.primefacesNonce,
    };
  }

  /**
   * Submit a step and update session state
   */
  private async submitStep(
    fields: Record<string, string>,
    dpmaViewId: string
  ): Promise<string> {
    const allFields = this.addNavigationFields(fields, dpmaViewId);
    const body = this.createUrlEncodedBody(allFields);

    const url = this.buildFormUrl();
    this.log(`Submitting step to ${url} with dpmaViewId=${dpmaViewId}`);

    const response = await this.client.post(url, body, {
      headers: {
        ...AJAX_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Referer': `${BASE_URL}${url}`,
      },
    });

    // Update step counter
    if (this.session) {
      this.session.stepCounter++;
    }

    // Extract new tokens from response if available
    if (response.data && typeof response.data === 'string') {
      // Store the response HTML for dynamic field extraction
      this.lastResponseHtml = response.data;

      // Save step response for debugging
      const stepNum = this.session?.stepCounter || 0;
      this.saveDebugFile(`step${stepNum + 1}_response.xml`, response.data);

      // Check if this response is an error page - this is CRITICAL
      if (response.data.includes('error.xhtml') || response.data.includes('StatusCode: 500')) {
        const stepNum = (this.session?.stepCounter || 0) + 1;
        this.log(`FATAL ERROR: Step ${stepNum} response contains error page!`);
        this.log(`Check debug_step${stepNum}_response.xml for details`);

        // Extract error message if available
        const errorMatch = response.data.match(/ui-message-error[^>]*>([^<]+)/);
        if (errorMatch) {
          this.log(`Error message: ${errorMatch[1]}`);
        }

        // Extract page title for context
        const titleMatch = response.data.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) {
          this.log(`Page title: ${titleMatch[1]}`);
        }

        throw new Error(`Step ${stepNum} failed: Server returned error page (dpmaViewId=${dpmaViewId}). Check debug_step${stepNum}_response.xml`);
      }

      try {
        // The AJAX response contains updated tokens in CDATA sections
        // Extract ViewState
        const viewStateMatch = response.data.match(/jakarta\.faces\.ViewState[^>]*>(?:<!\[CDATA\[)?([^<\]]+)/);
        if (viewStateMatch && this.session) {
          this.session.tokens.viewState = viewStateMatch[1];
        }

        // Extract ClientWindow - this is critical for URL construction
        // Format: <update id="j_id1:jakarta.faces.ClientWindow:0"><![CDATA[uuid:counter]]></update>
        const clientWindowMatch = response.data.match(/jakarta\.faces\.ClientWindow[^>]*>(?:<!\[CDATA\[)?([^<\]]+)/);
        if (clientWindowMatch && this.session) {
          this.session.tokens.clientWindow = clientWindowMatch[1];
          this.log(`Updated ClientWindow: ${clientWindowMatch[1]}`);
        }
      } catch {
        // Token extraction from AJAX response is optional
      }
    }

    return response.data;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Initialize a new session with DPMA
   * This performs the initial navigation to get cookies and tokens
   */
  async initSession(): Promise<void> {
    this.log('Initializing session...');

    // Step 1: Load main page
    const mainPageResponse = await this.client.get(`${EDITOR_PATH}/index.xhtml`, {
      headers: BROWSER_HEADERS,
    });
    this.log('Loaded main page');

    // Step 2: Navigate to trademark start page
    // This will redirect to a URL with jfwid parameter
    let jfwid: string | null = null;

    // First request - expect 302 redirect
    const startPageResponse = await this.client.get(`${EDITOR_PATH}/w7005-start.xhtml`, {
      headers: {
        ...BROWSER_HEADERS,
        'Referer': `${BASE_URL}${EDITOR_PATH}/index.xhtml`,
      },
      maxRedirects: 0, // Don't follow automatically
      validateStatus: (status) => status === 200 || status === 302,
    });

    // Check if we got a redirect
    if (startPageResponse.status === 302) {
      const location = startPageResponse.headers.location as string;
      this.log('Redirect received from start page', location);

      // Try to extract jfwid from redirect location
      const jfwidMatch = location.match(/jfwid=([^&:]+(?::\d+)?)/);
      if (jfwidMatch) {
        jfwid = jfwidMatch[1];
        this.log('Extracted jfwid from redirect:', jfwid);

        // Follow the redirect manually
        await this.client.get(location.startsWith('http') ? location : `${BASE_URL}${location}`, {
          headers: {
            ...BROWSER_HEADERS,
            'Referer': `${BASE_URL}${EDITOR_PATH}/index.xhtml`,
          },
        });
      }
    }

    // If no redirect, try to extract from final URL or HTML content
    if (!jfwid) {
      // Try to extract from HTML content (hidden form fields or JavaScript)
      const htmlContent = startPageResponse.data as string;
      const jfwidInHtml = htmlContent.match(/jfwid[=:]([^&"'\s]+)/);
      if (jfwidInHtml) {
        jfwid = jfwidInHtml[1];
        this.log('Extracted jfwid from HTML:', jfwid);
      }
    }

    if (!jfwid) {
      throw new Error('Failed to extract jfwid from session initialization');
    }

    // The jfwid includes a server-assigned counter (e.g., "uuid:4")
    // We must use this exact value - the counter is NOT always 0!
    this.log(`Extracted jfwid: ${jfwid}`);

    // Step 3: Start the trademark application (navigate to web form)
    // Use the exact jfwid from the redirect - do NOT modify the counter
    const formUrl = `${EDITOR_PATH}/w7005/w7005web.xhtml?jftfdi=&jffi=w7005&jfwid=${jfwid}`;
    const formResponse = await this.client.get(formUrl, {
      headers: {
        ...BROWSER_HEADERS,
        'Referer': `${BASE_URL}${EDITOR_PATH}/w7005-start.xhtml?jfwid=${jfwid}`,
      },
    });

    // Debug: Log HTML content to understand structure
    const formHtml = formResponse.data as string;
    this.log('Form page received, length:', formHtml.length);

    // Check if we got the actual form page or an error/redirect page
    if (formHtml.includes('editor-form') || formHtml.includes('daf-applicant')) {
      this.log('Form page contains expected elements');
    } else {
      this.log('WARNING: Form page might not be the expected page');
      this.log('Page title:', formHtml.match(/<title>([^<]+)<\/title>/)?.[1] || 'unknown');
    }

    // Debug: Save HTML to file for inspection
    this.saveDebugFile('form.html', formHtml);

    // Extract tokens from the form page
    // Pass the full jfwid (with counter) as fallback for ClientWindow extraction
    const tokens = this.extractTokens(formHtml, jfwid);
    this.log('Extracted tokens', {
      viewState: tokens.viewState.substring(0, 20) + '...',
      clientWindow: tokens.clientWindow,
      nonce: tokens.primefacesNonce ? tokens.primefacesNonce.substring(0, 10) + '...' : '(empty)',
    });

    // Initialize session state
    // Store the base UUID (without counter) for reference, but ClientWindow in tokens has the full value
    const baseJfwid = jfwid.split(':')[0];
    this.session = {
      jfwid: baseJfwid,
      stepCounter: 0,
      tokens,
    };

    this.log('Session initialized successfully');
  }

  /**
   * Step 1: Submit applicant information (Anmelder)
   */
  async submitApplicant(request: TrademarkRegistrationRequest): Promise<void> {
    this.log('Step 1: Submitting applicant information...');

    const { applicant, sanctions } = request;
    const fields: Record<string, string> = {};

    if (applicant.type === ApplicantType.NATURAL) {
      const natural = applicant as NaturalPersonApplicant;
      fields['daf-applicant:addressEntityType'] = 'natural';
      if (natural.salutation) {
        fields['daf-applicant:namePrefix:valueHolder_input'] = natural.salutation;
      }
      fields['daf-applicant:lastName:valueHolder'] = natural.lastName;
      fields['daf-applicant:firstName:valueHolder'] = natural.firstName;
      if (natural.nameSuffix) {
        fields['daf-applicant:nameSuffix:valueHolder'] = natural.nameSuffix;
      }
      fields['daf-applicant:street:valueHolder'] = natural.address.street;
      if (natural.address.addressLine1) {
        fields['daf-applicant:addressLine1:valueHolder'] = natural.address.addressLine1;
      }
      if (natural.address.addressLine2) {
        fields['daf-applicant:addressLine2:valueHolder'] = natural.address.addressLine2;
      }
      fields['daf-applicant:zip:valueHolder'] = natural.address.zip;
      fields['daf-applicant:city:valueHolder'] = natural.address.city;
      fields['daf-applicant:country:valueHolder_input'] = natural.address.country;
    } else {
      const legal = applicant as LegalEntityApplicant;
      fields['daf-applicant:addressEntityType'] = 'legal';
      fields['daf-applicant:organisationName:valueHolder'] = legal.companyName;
      if (legal.legalForm) {
        fields['daf-applicant:legalForm:valueHolder'] = legal.legalForm;
      }
      fields['daf-applicant:street:valueHolder'] = legal.address.street;
      if (legal.address.addressLine1) {
        fields['daf-applicant:addressLine1:valueHolder'] = legal.address.addressLine1;
      }
      if (legal.address.addressLine2) {
        fields['daf-applicant:addressLine2:valueHolder'] = legal.address.addressLine2;
      }
      fields['daf-applicant:zip:valueHolder'] = legal.address.zip;
      fields['daf-applicant:city:valueHolder'] = legal.address.city;
      fields['daf-applicant:country:valueHolder_input'] = legal.address.country;
    }

    // Sanctions declaration
    fields['daf-applicant:daf-declaration:nationalitySanctionLine'] =
      sanctions.hasRussianNationality ? SanctionDeclaration.TRUE : SanctionDeclaration.FALSE;
    fields['daf-applicant:daf-declaration:residenceSanctionLine'] =
      sanctions.hasRussianResidence ? SanctionDeclaration.TRUE : SanctionDeclaration.FALSE;
    fields['daf-applicant:daf-declaration:evidenceProofCheckbox_input'] = 'on';
    fields['daf-applicant:daf-declaration:changesProofCheckbox_input'] = 'on';

    await this.submitStep(fields, DPMA_VIEW_IDS.STEP_1_TO_2);
    this.log('Step 1 completed');
  }

  /**
   * Step 2: Skip lawyer/law firm (Anwalt/Kanzlei)
   */
  async skipLawyer(): Promise<void> {
    this.log('Step 2: Skipping lawyer information...');
    await this.submitStep({}, DPMA_VIEW_IDS.STEP_2_TO_3);
    this.log('Step 2 completed');
  }

  /**
   * Step 3: Submit delivery address (Zustelladresse)
   *
   * This step requires full address information, not just email.
   * We copy the applicant's address to the delivery address.
   *
   * IMPORTANT: The country field uses ISO codes (DE, AT, etc.), NOT display names!
   * All fields must be sent, even if empty, to match browser behavior.
   */
  async submitDeliveryAddress(request: TrademarkRegistrationRequest): Promise<void> {
    this.log('Step 3: Submitting delivery address...');

    const { applicant, email } = request;
    const address = applicant.address;

    // Build delivery address fields - must match browser exactly
    // All fields must be included, even empty ones
    const fields: Record<string, string> = {
      // Navigation fields
      'dpmaViewItemIndex': '0',

      // Address selection dropdown
      'daf-correspondence:address-ref-combo-a:valueHolder_input': 'Neue Adresse',

      // Address type (natural or legal person)
      'daf-correspondence:addressEntityType': applicant.type === 'natural' ? 'natural' : 'legal',

      // Name prefix fields (all three must be sent)
      'daf-correspondence:namePrefix:valueHolder_focus': '',
      'daf-correspondence:namePrefix:valueHolder_input': '',
      'daf-correspondence:namePrefix:valueHolder_editableInput': ' ',

      // Name suffix
      'daf-correspondence:nameSuffix:valueHolder': '',

      // Address fields
      'daf-correspondence:street:valueHolder': address.street,
      'daf-correspondence:addressLine1:valueHolder': address.addressLine1 || '',
      'daf-correspondence:addressLine2:valueHolder': address.addressLine2 || '',
      'daf-correspondence:mailbox:valueHolder': '',
      'daf-correspondence:zip:valueHolder': address.zip,
      'daf-correspondence:city:valueHolder': address.city,
      // IMPORTANT: Use ISO country code, NOT display name!
      'daf-correspondence:country:valueHolder_input': address.country,

      // Contact fields
      'daf-correspondence:phone:valueHolder': '',
      'daf-correspondence:fax:valueHolder': '',
      'daf-correspondence:email:valueHolder': email,

      // Panel state
      'editorPanel_active': 'null',
    };

    // Add name fields based on applicant type
    if (applicant.type === 'natural') {
      fields['daf-correspondence:lastName:valueHolder'] = applicant.lastName;
      fields['daf-correspondence:firstName:valueHolder'] = applicant.firstName;
    } else {
      fields['daf-correspondence:companyName:valueHolder'] = applicant.companyName;
      if (applicant.legalForm) {
        fields['daf-correspondence:legalForm:valueHolder'] = applicant.legalForm;
      }
    }

    await this.submitStep(fields, DPMA_VIEW_IDS.STEP_3_TO_4);
    this.log('Step 3 completed');
  }

  /**
   * Convert ISO country code to German display name
   */
  private getCountryDisplayName(countryCode: string): string {
    const countryMap: Record<string, string> = {
      'DE': 'Deutschland',
      'AT': 'Österreich',
      'CH': 'Schweiz',
      'FR': 'Frankreich',
      'IT': 'Italien',
      'ES': 'Spanien',
      'NL': 'Niederlande',
      'BE': 'Belgien',
      'PL': 'Polen',
      'GB': 'Großbritannien',
      'US': 'Vereinigte Staaten von Amerika',
    };
    return countryMap[countryCode] || countryCode;
  }

  /**
   * Trigger a PrimeFaces dropdown change event (required before form submission)
   * This simulates the browser behavior when selecting from a dropdown
   */
  private async triggerDropdownChange(
    dropdownId: string,
    value: string,
    additionalFields?: Record<string, string>
  ): Promise<void> {
    if (!this.session) {
      throw new Error('Session not initialized');
    }

    this.log(`Triggering dropdown change for ${dropdownId} with value: ${value}`);

    const fields: Record<string, string> = {
      'jakarta.faces.partial.ajax': 'true',
      'jakarta.faces.source': dropdownId,
      'jakarta.faces.behavior.event': 'change',
      'jakarta.faces.partial.execute': 'editor-form',
      'jakarta.faces.partial.render': 'editor-form',
      [`${dropdownId}_input`]: value,
      'editor-form': 'editor-form',
      'editorPanel_active': 'null',
      'jakarta.faces.ViewState': this.session.tokens.viewState,
      'jakarta.faces.ClientWindow': this.session.tokens.clientWindow,
      'primefaces.nonce': this.session.tokens.primefacesNonce,
      ...additionalFields,
    };

    const body = this.createUrlEncodedBody(fields);
    const url = this.buildFormUrl();

    const response = await this.client.post(url, body, {
      headers: {
        ...AJAX_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Referer': `${BASE_URL}${url}`,
      },
    });

    // Update tokens from response
    if (response.data && typeof response.data === 'string') {
      this.lastResponseHtml = response.data;

      // Save debug output
      this.saveDebugFile('dropdown_change.xml', response.data);

      // Extract updated tokens
      const viewStateMatch = response.data.match(/jakarta\.faces\.ViewState[^>]*>(?:<!\[CDATA\[)?([^<\]]+)/);
      if (viewStateMatch && this.session) {
        this.session.tokens.viewState = viewStateMatch[1];
      }

      const clientWindowMatch = response.data.match(/jakarta\.faces\.ClientWindow[^>]*>(?:<!\[CDATA\[)?([^<\]]+)/);
      if (clientWindowMatch && this.session) {
        this.session.tokens.clientWindow = clientWindowMatch[1];
        this.log(`Updated ClientWindow after dropdown change: ${clientWindowMatch[1]}`);
      }

      // Extract new nonce if present
      const nonceMatch = response.data.match(/PrimeFaces\.csp\.init\(['"]([^'"]+)['"]\)/);
      if (nonceMatch && this.session) {
        this.session.tokens.primefacesNonce = nonceMatch[1];
        this.log(`Updated nonce after dropdown change: ${nonceMatch[1]}`);
      }
    }

    this.log('Dropdown change event triggered successfully');
  }

  /**
   * Step 4: Submit trademark information (Marke)
   *
   * IMPORTANT: PrimeFaces dropdowns require a change event to be triggered
   * before the form can properly validate. We must:
   * 1. First trigger the dropdown change event (simulates selecting from dropdown)
   * 2. Then submit the full form with the text value
   */
  async submitTrademark(request: TrademarkRegistrationRequest): Promise<void> {
    this.log('Step 4: Submitting trademark information...');

    const { trademark } = request;

    // Determine the dropdown value based on trademark type
    let dropdownValue: string;
    switch (trademark.type) {
      case TrademarkType.WORD:
        dropdownValue = 'word';
        break;
      case TrademarkType.FIGURATIVE:
        dropdownValue = 'image';
        throw new Error('Image trademark upload not yet implemented');
      case TrademarkType.COMBINED:
        dropdownValue = 'figurative';
        throw new Error('Combined trademark upload not yet implemented');
      default:
        const _exhaustiveCheck: never = trademark;
        throw new Error(`Trademark type not yet implemented: ${(_exhaustiveCheck as any).type}`);
    }

    // STEP 4a: First trigger the dropdown change event
    // This is CRITICAL - PrimeFaces needs this to properly register the selection
    await this.triggerDropdownChange('markFeatureCombo:valueHolder', dropdownValue, {
      'dpmaViewItemIndex': '0',
    });

    // STEP 4b: Now submit the full form with the trademark text
    const fields: Record<string, string> = {
      'dpmaViewItemIndex': '0',
      'editorPanel_active': 'null',
      'markFeatureCombo:valueHolder_input': dropdownValue,
      'mark-verbalText:valueHolder': trademark.text,
      'mark-docRefNumber:valueHolder': request.internalReference || '',
    };

    await this.submitStep(fields, DPMA_VIEW_IDS.STEP_4_TO_5);
    this.log('Step 4 completed');
  }

  /**
   * Trigger a Nice class checkbox change event via AJAX
   * This is CRITICAL - the checkbox selection must trigger an AJAX call
   * to register the selection and populate the lead class dropdown
   */
  private async triggerCheckboxChange(checkboxId: string): Promise<void> {
    if (!this.session) {
      throw new Error('Session not initialized');
    }

    // The checkbox ID format is: tmclassEditorGt:tmclassNode_9:j_idt2281:selectBox_input
    // But for the change event source, we need: tmclassEditorGt:tmclassNode_9:j_idt2281:selectBox
    const selectBoxId = checkboxId.replace('_input', '');

    this.log(`Triggering checkbox change for ${selectBoxId}`);

    const fields: Record<string, string> = {
      'jakarta.faces.partial.ajax': 'true',
      'jakarta.faces.source': selectBoxId,
      'jakarta.faces.behavior.event': 'change',
      'jakarta.faces.partial.execute': selectBoxId,
      'jakarta.faces.partial.render': `${selectBoxId} @(.termViewCol) @(.tmClassEditorSelected) @(.leadingClassCombo) @(.hintSelectGroup)`,
      [checkboxId]: 'on',
      'editor-form': 'editor-form',
      'jakarta.faces.ViewState': this.session.tokens.viewState,
      'jakarta.faces.ClientWindow': this.session.tokens.clientWindow,
      'primefaces.nonce': this.session.tokens.primefacesNonce,
    };

    const body = this.createUrlEncodedBody(fields);
    const url = this.buildFormUrl();

    const response = await this.client.post(url, body, {
      headers: {
        ...AJAX_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Referer': `${BASE_URL}${url}`,
      },
    });

    // Update tokens from response
    if (response.data && typeof response.data === 'string') {
      this.lastResponseHtml = response.data;

      // Save debug output
      this.saveDebugFile('checkbox_change.xml', response.data);

      // Extract updated tokens
      const viewStateMatch = response.data.match(/jakarta\.faces\.ViewState[^>]*>(?:<!\[CDATA\[)?([^<\]]+)/);
      if (viewStateMatch && this.session) {
        this.session.tokens.viewState = viewStateMatch[1];
      }

      const clientWindowMatch = response.data.match(/jakarta\.faces\.ClientWindow[^>]*>(?:<!\[CDATA\[)?([^<\]]+)/);
      if (clientWindowMatch && this.session) {
        this.session.tokens.clientWindow = clientWindowMatch[1];
      }

      // Extract new nonce if present
      const nonceMatch = response.data.match(/PrimeFaces\.csp\.init\(['"]([^'"]+)['"]\)/);
      if (nonceMatch && this.session) {
        this.session.tokens.primefacesNonce = nonceMatch[1];
      }
    }

    this.log('Checkbox change event triggered successfully');
  }

  /**
   * Step 5: Submit Nice classification (WDVZ - Waren und Dienstleistungen)
   *
   * This is complex because Nice class checkboxes have dynamic IDs.
   * We need to:
   * 1. Expand each class to load its subcategories
   * 2. Find the checkbox IDs from the AJAX response
   * 3. TRIGGER CHECKBOX CHANGE EVENTS (this populates the lead class dropdown!)
   * 4. Submit the form with lead class selected
   */
  async submitNiceClasses(request: TrademarkRegistrationRequest): Promise<void> {
    this.log('Step 5: Submitting Nice classification...');

    const { niceClasses, leadClass } = request;

    if (!this.session) {
      throw new Error('Session not initialized');
    }

    // Set lead class (defaults to first selected class)
    const effectiveLeadClass = leadClass ?? niceClasses[0]?.classNumber ?? 9;

    // Collect all checkbox IDs
    const selectedCheckboxIds: string[] = [];

    // For each Nice class, expand it and select the first available term
    for (const niceClass of niceClasses) {
      const classNum = niceClass.classNumber;
      this.log(`Expanding Nice class ${classNum}...`);

      try {
        // Step 1: Expand the class tree to load subcategories
        const expandResponse = await this.expandNiceClass(classNum);

        // Step 2: Parse the response to find checkbox IDs
        const checkboxId = this.findFirstCheckboxId(expandResponse, classNum);

        if (checkboxId) {
          this.log(`Found checkbox for class ${classNum}: ${checkboxId}`);
          selectedCheckboxIds.push(checkboxId);

          // CRITICAL: Trigger the checkbox change event!
          // This registers the selection server-side and populates the lead class dropdown
          await this.triggerCheckboxChange(checkboxId);
        } else {
          this.log(`Warning: Could not find checkbox for class ${classNum}, trying alternative method...`);

          // Alternative: Try to select at class level (group header)
          const classCheckboxId = await this.findClassLevelCheckbox(classNum);
          if (classCheckboxId) {
            selectedCheckboxIds.push(classCheckboxId);
            await this.triggerCheckboxChange(classCheckboxId);
            this.log(`Using class-level checkbox: ${classCheckboxId}`);
          } else {
            this.log(`Warning: No checkbox found for class ${classNum}`);
          }
        }
      } catch (error: any) {
        this.log(`Error expanding class ${classNum}: ${error.message}`);
        // Continue with other classes
      }
    }

    // Build the final form fields - include all selected checkboxes
    const fields: Record<string, string> = {};
    for (const checkboxId of selectedCheckboxIds) {
      fields[checkboxId] = 'on';
    }
    fields['tmclassEditorGt:leadingClassCombo_input'] = String(effectiveLeadClass);

    this.log(`Submitting Nice classes with ${selectedCheckboxIds.length} selections`);
    this.log('Selected checkboxes:', selectedCheckboxIds);

    await this.submitStep(fields, DPMA_VIEW_IDS.STEP_5_TO_6);
    this.log('Step 5 completed');
  }

  /**
   * Expand a Nice class tree node to load its subcategories
   */
  private async expandNiceClass(classNumber: number): Promise<string> {
    if (!this.session) {
      throw new Error('Session not initialized');
    }

    const url = this.buildFormUrl();

    // PrimeFaces tree expand request - use correct button ID discovered from live form
    const expandButtonId = `tmclassEditorGt:tmclassNode_${classNumber}:iconExpandedState`;
    const expandFields: Record<string, string> = {
      'jakarta.faces.partial.ajax': 'true',
      'jakarta.faces.source': expandButtonId,
      'jakarta.faces.partial.execute': expandButtonId,
      'jakarta.faces.partial.render': 'tmclassEditorGt',
      'jakarta.faces.behavior.event': 'action',
      [expandButtonId]: expandButtonId,
      'editor-form': 'editor-form',
      'jakarta.faces.ViewState': this.session.tokens.viewState,
      'jakarta.faces.ClientWindow': this.session.tokens.clientWindow,
      'primefaces.nonce': this.session.tokens.primefacesNonce,
    };

    const body = this.createUrlEncodedBody(expandFields);

    const response = await this.client.post(url, body, {
      headers: {
        ...AJAX_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Referer': `${BASE_URL}${url}`,
      },
    });

    // Update ViewState if present in response
    if (response.data && typeof response.data === 'string') {
      const viewStateMatch = response.data.match(/jakarta\.faces\.ViewState[^>]*>(?:<!\[CDATA\[)?([^<\]]+)/);
      if (viewStateMatch) {
        this.session.tokens.viewState = viewStateMatch[1];
      }
    }

    return response.data;
  }

  /**
   * Find the first checkbox ID from an expanded class response
   */
  private findFirstCheckboxId(htmlResponse: string, classNumber: number): string | null {
    // Look for checkbox input patterns in the AJAX response
    // Pattern: tmclassEditorGt:tmclassNode_X:j_idtNNN:selectBox_input
    const patterns = [
      // Standard checkbox pattern
      new RegExp(`(tmclassEditorGt:tmclassNode_${classNumber}:[^:]+:selectBox_input)`, 'g'),
      // Alternative pattern with different structure
      new RegExp(`(tmclassEditorGt:[^"']*tmclassNode[^"']*${classNumber}[^"']*selectBox[^"']*)`, 'g'),
      // Input name pattern
      new RegExp(`name="(tmclassEditorGt:[^"]*:selectBox_input)"`, 'g'),
    ];

    for (const pattern of patterns) {
      const matches = htmlResponse.match(pattern);
      if (matches && matches.length > 0) {
        // Clean up the match - extract just the field name
        let fieldName = matches[0];
        if (fieldName.startsWith('name="')) {
          fieldName = fieldName.replace('name="', '').replace('"', '');
        }
        return fieldName;
      }
    }

    // Also try to find any ui-chkbox elements with IDs
    const checkboxIdPattern = /id="([^"]*tmclassNode[^"]*checkbox[^"]*)"/gi;
    const idMatches = htmlResponse.match(checkboxIdPattern);
    if (idMatches && idMatches.length > 0) {
      // Convert the ID to an input name
      const id = idMatches[0].replace('id="', '').replace('"', '');
      // PrimeFaces convention: checkbox input is usually ID + "_input"
      return id.replace('_checkbox', ':selectBox_input');
    }

    return null;
  }

  /**
   * Try to find a class-level checkbox (selects the entire class header)
   */
  private async findClassLevelCheckbox(classNumber: number): Promise<string | null> {
    // The class-level selection might use a different pattern
    // Try common patterns for selecting an entire class
    const possibleIds = [
      `tmclassEditorGt:tmclassNode_${classNumber}:selectBox_input`,
      `tmclassEditorGt:tmclassEditorTree:${classNumber - 1}:selectBox_input`,
      `tmclassEditorGt:classSelect_${classNumber}_input`,
    ];

    // For now, return the most likely pattern
    // In production, we'd need to parse the actual page HTML
    return possibleIds[0];
  }

  /**
   * Extract dynamic JSF field IDs from HTML response
   * These are fields like j_idt9679:j_idt9684:itemsPanel_active that change per session
   *
   * Example HTML structure from DPMA:
   * <input id="j_idt9679:j_idt9684:itemsPanel_active" name="j_idt9679:j_idt9684:itemsPanel_active" type="hidden" autocomplete="off" value="-1">
   */
  private extractDynamicFields(html: string): Record<string, string> {
    const dynamicFields: Record<string, string> = {};

    // Pattern 1: Match the exact format seen in Chrome DevTools
    // <input id="..." name="j_idt...:itemsPanel_active" type="hidden" ... value="...">
    const exactPattern = /id="(j_idt\d+[^"]*:itemsPanel_active)"[^>]*name="([^"]+)"[^>]*value="([^"]*)"/g;
    let match;
    while ((match = exactPattern.exec(html)) !== null) {
      const fieldName = match[2];
      const fieldValue = match[3] || '-1';
      dynamicFields[fieldName] = fieldValue;
      this.log(`Found dynamic field (exact): ${fieldName} = ${fieldValue}`);
    }

    // Pattern 2: Match with name first, then value (different attribute order)
    const nameFirstPattern = /name="(j_idt\d+[^"]*:itemsPanel_active)"[^>]*value="([^"]*)"/g;
    while ((match = nameFirstPattern.exec(html)) !== null) {
      const fieldName = match[1];
      const fieldValue = match[2] || '-1';
      if (!dynamicFields[fieldName]) {
        dynamicFields[fieldName] = fieldValue;
        this.log(`Found dynamic field (nameFirst): ${fieldName} = ${fieldValue}`);
      }
    }

    // Pattern 3: Match with value before name (another possible order)
    const valueFirstPattern = /value="([^"]*)"[^>]*name="(j_idt\d+[^"]*:itemsPanel_active)"/g;
    while ((match = valueFirstPattern.exec(html)) !== null) {
      const fieldName = match[2];
      const fieldValue = match[1] || '-1';
      if (!dynamicFields[fieldName]) {
        dynamicFields[fieldName] = fieldValue;
        this.log(`Found dynamic field (valueFirst): ${fieldName} = ${fieldValue}`);
      }
    }

    // Pattern 4: Look in CDATA sections (JSF AJAX responses wrap content in CDATA)
    const cdataPattern = /<!\[CDATA\[[\s\S]*?(?:name|id)="(j_idt\d+[^"]*:itemsPanel_active)"[^>]*value="([^"]*)"/g;
    while ((match = cdataPattern.exec(html)) !== null) {
      const fieldName = match[1];
      const fieldValue = match[2] || '-1';
      if (!dynamicFields[fieldName]) {
        dynamicFields[fieldName] = fieldValue;
        this.log(`Found dynamic field (CDATA): ${fieldName} = ${fieldValue}`);
      }
    }

    // If no itemsPanel_active fields found, log warning but don't fail
    if (Object.keys(dynamicFields).length === 0) {
      this.log('WARNING: No dynamic j_idt*:itemsPanel_active fields found in response');
      // Debug: Log first 1000 chars containing j_idt pattern
      const jidtMatches = html.match(/j_idt\d+[^"']*/g);
      if (jidtMatches) {
        this.log('Found j_idt patterns:', jidtMatches.slice(0, 10).join(', '));
      }
    }

    return dynamicFields;
  }

  /**
   * Step 6: Submit additional options (Sonstiges)
   */
  async submitOptions(request: TrademarkRegistrationRequest): Promise<void> {
    this.log('Step 6: Submitting additional options...');

    const fields: Record<string, string> = {};
    const { options } = request;

    if (options) {
      if (options.acceleratedExamination) {
        fields['acceleratedExamination:valueHolder_input'] = 'on';
        this.log('Accelerated examination requested');
      }
      if (options.certificationMark) {
        fields['mark-certification-chkbox:valueHolder_input'] = 'on';
        this.log('Certification mark requested');
      }
      if (options.licensingDeclaration) {
        fields['mark-licenseIndicator-chkbox:valueHolder_input'] = 'on';
        this.log('Licensing declaration requested');
      }
      if (options.saleDeclaration) {
        fields['mark-dispositionIndicator-chkbox:valueHolder_input'] = 'on';
        this.log('Sale declaration requested');
      }
    }

    await this.submitStep(fields, DPMA_VIEW_IDS.STEP_6_TO_7);
    this.log('Step 6 completed');
  }

  /**
   * Step 7: Submit payment method (Zahlung)
   * This navigates to Step 8 (summary page) where the final submission form is rendered
   */
  async submitPayment(request: TrademarkRegistrationRequest): Promise<void> {
    this.log('Step 7: Submitting payment information...');

    const fields: Record<string, string> = {
      'paymentForm:paymentTypeSelectOneRadio': request.paymentMethod,
    };

    if (request.paymentMethod === PaymentMethod.SEPA_DIRECT_DEBIT && request.sepaDetails) {
      // SEPA fields - exact names TBD
      this.log('SEPA details provided (field names TBD)');
    }

    const responseHtml = await this.submitStep(fields, DPMA_VIEW_IDS.STEP_7_TO_8);
    this.log('Step 7 completed');

    // Debug: Save Step 7 response (which should be Step 8 page)
    this.saveDebugFile('step7_payment_response.xml', responseHtml);
    if (this.debug) {
      this.log('Step 7 response length:', responseHtml.length);
      if (responseHtml.includes('itemsPanel')) {
        this.log('Step 7 response CONTAINS "itemsPanel"');
      } else {
        this.log('Step 7 response does NOT contain "itemsPanel"');
      }
    }
  }

  /**
   * Step 8: Final submission (Zusammenfassung)
   * Returns the encrypted transaction ID for the Versand service
   */
  async submitFinal(request: TrademarkRegistrationRequest): Promise<string> {
    this.log('Step 8: Final submission...');

    if (!this.session) {
      throw new Error('Session not initialized');
    }

    // Get the sender name for confirmation
    let senderName: string;
    if (request.applicant.type === ApplicantType.NATURAL) {
      const natural = request.applicant as NaturalPersonApplicant;
      senderName = `${natural.firstName} ${natural.lastName}`;
    } else {
      const legal = request.applicant as LegalEntityApplicant;
      senderName = legal.companyName;
    }

    const fields: Record<string, string> = {
      'chBoxConfirmText_input': 'on',
      'applicantNameTextField:valueHolder': senderName,
    };

    // Extract dynamic JSF field IDs from the Step 7 response (summary page HTML)
    // These are fields like j_idt9679:j_idt9684:itemsPanel_active that change per session
    const dynamicFields = this.extractDynamicFields(this.lastResponseHtml);
    this.log(`Extracted ${Object.keys(dynamicFields).length} dynamic fields from Step 7 response`);

    // Build the final submission request
    // Field names discovered via Chrome DevTools MCP walkthrough
    const allFields = {
      ...fields,
      ...dynamicFields, // Include the dynamic JSF fields
      'jakarta.faces.partial.ajax': 'true',
      'jakarta.faces.source': 'btnSubmitRegistration',
      'jakarta.faces.partial.execute': '@all',
      'jakarta.faces.partial.render': 'editor-form',
      'btnSubmitRegistration': 'btnSubmitRegistration',
      'editor-form': 'editor-form',
      'editorPanel_active': 'null',
      'jakarta.faces.ViewState': this.session.tokens.viewState,
      'jakarta.faces.ClientWindow': this.session.tokens.clientWindow,
      'primefaces.nonce': this.session.tokens.primefacesNonce,
    };

    const body = this.createUrlEncodedBody(allFields);
    const url = this.buildFormUrl();

    this.log('Sending final submission...');

    // This request will redirect to the Versand service
    // Note: With maxRedirects: 0 and validateStatus accepting 302,
    // the redirect will be returned as a normal response, NOT thrown as error
    const response = await this.client.post(url, body, {
      headers: {
        ...AJAX_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Referer': `${BASE_URL}${url}`,
      },
      maxRedirects: 0,
    });

    // Check if we got a 302 redirect (this is the expected path)
    if (response.status === 302) {
      const location = response.headers.location as string;
      this.log('Redirect received (302)', location);

      const match = location.match(/transactionId=([^&]+)/);
      if (match) {
        const encryptedTransactionId = decodeURIComponent(match[1]);
        this.session.encryptedTransactionId = encryptedTransactionId;
        this.log('Extracted encrypted transaction ID from redirect');
        return encryptedTransactionId;
      }
      throw new Error('302 redirect received but no transactionId in location header');
    }

    // If not a redirect, check for transaction ID in response body
    // This can happen if the response contains a JavaScript redirect or meta refresh
    if (typeof response.data === 'string') {
      // Look for transactionId in various formats
      const patterns = [
        /transactionId=([^&"'\s]+)/,
        /transactionId['"]\s*:\s*['"]([^'"]+)/,
        /flowReturn\.xhtml\?[^"']*transactionId=([^&"']+)/,
      ];

      for (const pattern of patterns) {
        const match = response.data.match(pattern);
        if (match) {
          const encryptedTransactionId = decodeURIComponent(match[1]);
          this.session.encryptedTransactionId = encryptedTransactionId;
          this.log('Extracted encrypted transaction ID from response body');
          return encryptedTransactionId;
        }
      }
    }

    this.log('Response status:', response.status);
    this.log('Response headers:', response.headers);
    this.log('Response data (first 500 chars):', typeof response.data === 'string' ? response.data.substring(0, 500) : response.data);

    // Save full response for debugging
    if (typeof response.data === 'string') {
      this.saveDebugFile('step8_final_response.xml', response.data);

      if (this.debug) {
        // Check for validation errors in the response
        if (response.data.includes('ui-message-error') || response.data.includes('ui-messages-error')) {
          this.log('VALIDATION ERRORS DETECTED in response');
          const errorMatch = response.data.match(/ui-message-error[^>]*>([^<]+)/g);
          if (errorMatch) {
            this.log('Error messages:', errorMatch);
          }
        }

        // Check if the page title indicates we're still on the form
        const titleMatch = response.data.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) {
          this.log('Page title:', titleMatch[1]);
        }
      }
    }

    throw new Error(`Failed to get transaction ID from final submission (status: ${response.status})`);
  }

  /**
   * Complete the submission via the Versand service
   */
  async completeVersand(encryptedTransactionId: string): Promise<VersandResponse> {
    this.log('Completing submission via Versand service...');

    // Step 1: Load the Versand page (Vue.js app)
    const versandUrl = `${VERSAND_PATH}/index.html?flowId=w7005&transactionId=${encodeURIComponent(encryptedTransactionId)}`;
    await this.client.get(versandUrl, {
      headers: {
        ...BROWSER_HEADERS,
        'Referer': `${BASE_URL}${EDITOR_PATH}/flowReturn.xhtml`,
      },
    });

    // Step 2: POST to complete the submission (empty body!)
    const submitUrl = `${VERSAND_PATH}/versand?flowId=w7005&transactionId=${encodeURIComponent(encryptedTransactionId)}`;
    const response = await this.client.post(submitUrl, '', {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Length': '0',
        'Origin': BASE_URL,
        'Referer': `${BASE_URL}${versandUrl}`,
      },
    });

    const versandResponse = response.data as VersandResponse;
    this.log('Versand response', versandResponse);

    if (versandResponse.status !== 'VERSAND_SUCCESS') {
      throw new Error(`Versand failed: ${versandResponse.validationResult?.userMessage || 'Unknown error'}`);
    }

    return versandResponse;
  }

  /**
   * Download the receipt documents (returns raw ZIP and extracted documents)
   */
  async downloadDocuments(encryptedTransactionId: string): Promise<{
    zipData: Buffer;
    documents: DownloadedDocument[];
  }> {
    this.log('Downloading receipt documents...');

    const downloadUrl = `${VERSAND_PATH}/versand/anlagen?encryptedTransactionId=${encodeURIComponent(encryptedTransactionId)}`;
    const response = await this.client.get(downloadUrl, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Referer': `${BASE_URL}${VERSAND_PATH}/index.html`,
      },
      responseType: 'arraybuffer',
    });

    const zipData = Buffer.from(response.data);
    const documents: DownloadedDocument[] = [];

    // Extract individual files from the ZIP for API response
    try {
      const zip = new AdmZip(zipData);
      const entries = zip.getEntries();

      for (const entry of entries) {
        if (!entry.isDirectory) {
          documents.push({
            filename: entry.entryName,
            data: entry.getData(),
            mimeType: entry.entryName.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
          });
          this.log(`Extracted document: ${entry.entryName}`);
        }
      }
    } catch (error) {
      this.log('Failed to extract ZIP contents');
    }

    return { zipData, documents };
  }

  /**
   * Save the complete ZIP file to the receipts folder
   */
  saveReceiptZip(aktenzeichen: string, zipData: Buffer): string {
    const fs = require('fs');
    this.ensureDir(this.receiptsDir);
    const safeAkz = aktenzeichen.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${safeAkz}_documents.zip`;
    const filepath = `${this.receiptsDir}/${filename}`;
    fs.writeFileSync(filepath, zipData);
    this.log(`Saved ZIP archive: ${filepath}`);
    return filepath;
  }

  /**
   * Execute the complete trademark registration process
   */
  async registerTrademark(request: TrademarkRegistrationRequest): Promise<TrademarkRegistrationResult> {
    try {
      // Initialize session
      await this.initSession();

      // Step 1: Applicant
      await this.submitApplicant(request);

      // Step 2: Skip Lawyer
      await this.skipLawyer();

      // Step 3: Delivery Address
      await this.submitDeliveryAddress(request);

      // Step 4: Trademark
      await this.submitTrademark(request);

      // Step 5: Nice Classes
      await this.submitNiceClasses(request);

      // Step 6: Options
      await this.submitOptions(request);

      // Step 7: Payment
      await this.submitPayment(request);

      // Step 8: Final Submit
      const encryptedTransactionId = await this.submitFinal(request);

      // Complete via Versand service
      const versandResponse = await this.completeVersand(encryptedTransactionId);

      // Download documents (ZIP archive)
      const { zipData, documents } = await this.downloadDocuments(encryptedTransactionId);

      // Save the complete ZIP archive to dedicated folder
      let receiptFilePath: string | undefined;
      if (zipData.length > 0) {
        receiptFilePath = this.saveReceiptZip(versandResponse.akz, zipData);
        this.log(`ZIP archive saved to: ${receiptFilePath}`);
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
        receiptDocuments: documents, // All extracted documents
        receiptFilePath, // Path to saved ZIP file
      };

    } catch (error: any) {
      this.log('Registration failed', error);

      return {
        success: false,
        errorCode: error.code || 'UNKNOWN_ERROR',
        errorMessage: error.message || 'An unknown error occurred',
        failedAtStep: this.session?.stepCounter,
      };
    }
  }
}
