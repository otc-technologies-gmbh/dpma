/**
 * BaseStep - Abstract base class with shared functionality for all form steps
 */

import { TrademarkRegistrationRequest } from '../../types/dpma';
import { DPMAHttpClient, BASE_URL, AJAX_HEADERS, createUrlEncodedBody, addNavigationFields } from '../http';
import { SessionManager, TokenExtractor } from '../session';
import { DebugLogger } from '../utils/DebugLogger';

/**
 * Dependencies required by all steps
 */
export interface StepDependencies {
  http: DPMAHttpClient;
  session: SessionManager;
  tokenExtractor: TokenExtractor;
  logger: DebugLogger;
}

/**
 * Abstract base class for all registration steps
 */
export abstract class BaseStep {
  protected http: DPMAHttpClient;
  protected session: SessionManager;
  protected tokenExtractor: TokenExtractor;
  protected logger: DebugLogger;

  constructor(deps: StepDependencies) {
    this.http = deps.http;
    this.session = deps.session;
    this.tokenExtractor = deps.tokenExtractor;
    this.logger = deps.logger;
  }

  /**
   * Execute this step
   * @param request The trademark registration request
   * @returns Promise that resolves when step completes (may return value for some steps)
   */
  abstract execute(request: TrademarkRegistrationRequest): Promise<void | string>;

  /**
   * Submit a step and update session state
   */
  protected async submitStep(
    fields: Record<string, string>,
    dpmaViewId: string
  ): Promise<string> {
    const tokens = this.session.getTokens();
    const allFields = addNavigationFields(fields, dpmaViewId, tokens);
    const body = createUrlEncodedBody(allFields);

    const url = this.session.buildFormUrl();
    this.logger.log(`Submitting step to ${url} with dpmaViewId=${dpmaViewId}`);

    const response = await this.http.post(url, body, {
      headers: {
        ...AJAX_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Referer': `${BASE_URL}${url}`,
      },
    });

    // Update step counter
    this.session.incrementStep();

    // Extract new tokens from response if available
    if (response.data && typeof response.data === 'string') {
      // Store the response HTML for dynamic field extraction
      this.session.setLastResponse(response.data);

      // Save step response for debugging
      const stepNum = this.session.getStepCounter();
      this.logger.saveFile(`step${stepNum + 1}_response.xml`, response.data);

      // Check if this response is an error page
      if (response.data.includes('error.xhtml') || response.data.includes('StatusCode: 500')) {
        const currentStep = this.session.getStepCounter() + 1;
        this.logger.log(`FATAL ERROR: Step ${currentStep} response contains error page!`);

        // Extract error message if available
        const errorMatch = response.data.match(/ui-message-error[^>]*>([^<]+)/);
        if (errorMatch) {
          this.logger.log(`Error message: ${errorMatch[1]}`);
        }

        throw new Error(`Step ${currentStep} failed: Server returned error page (dpmaViewId=${dpmaViewId})`);
      }

      // Update tokens from response
      const updatedTokens = this.tokenExtractor.updateTokensFromResponse(
        response.data,
        this.session.getTokens()
      );
      this.session.setTokens(updatedTokens);

      // Log ClientWindow update
      const clientWindowMatch = response.data.match(/jakarta\.faces\.ClientWindow[^>]*>(?:<!\[CDATA\[)?([^<\]]+)/);
      if (clientWindowMatch) {
        this.logger.log(`Updated ClientWindow: ${clientWindowMatch[1]}`);
      }
    }

    return response.data;
  }

  /**
   * Trigger a PrimeFaces dropdown change event
   * This simulates the browser behavior when selecting from a dropdown
   */
  protected async triggerDropdownChange(
    dropdownId: string,
    value: string,
    additionalFields?: Record<string, string>
  ): Promise<void> {
    const tokens = this.session.getTokens();

    this.logger.log(`Triggering dropdown change for ${dropdownId} with value: ${value}`);

    const fields: Record<string, string> = {
      'jakarta.faces.partial.ajax': 'true',
      'jakarta.faces.source': dropdownId,
      'jakarta.faces.behavior.event': 'change',
      'jakarta.faces.partial.execute': 'editor-form',
      'jakarta.faces.partial.render': 'editor-form',
      [`${dropdownId}_input`]: value,
      'editor-form': 'editor-form',
      'editorPanel_active': 'null',
      'jakarta.faces.ViewState': tokens.viewState,
      'jakarta.faces.ClientWindow': tokens.clientWindow,
      'primefaces.nonce': tokens.primefacesNonce,
      ...additionalFields,
    };

    const body = createUrlEncodedBody(fields);
    const url = this.session.buildFormUrl();

    const response = await this.http.post(url, body, {
      headers: {
        ...AJAX_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Referer': `${BASE_URL}${url}`,
      },
    });

    // Update tokens from response
    if (response.data && typeof response.data === 'string') {
      this.session.setLastResponse(response.data);
      this.logger.saveFile('dropdown_change.xml', response.data);

      const updatedTokens = this.tokenExtractor.updateTokensFromResponse(
        response.data,
        this.session.getTokens()
      );
      this.session.setTokens(updatedTokens);

      // Log updates
      const clientWindowMatch = response.data.match(/jakarta\.faces\.ClientWindow[^>]*>(?:<!\[CDATA\[)?([^<\]]+)/);
      if (clientWindowMatch) {
        this.logger.log(`Updated ClientWindow after dropdown change: ${clientWindowMatch[1]}`);
      }
    }

    this.logger.log('Dropdown change event triggered successfully');
  }
}
