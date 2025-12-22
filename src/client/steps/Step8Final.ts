/**
 * Step8Final - Final submission (Zusammenfassung)
 * Returns the encrypted transaction ID for the Versand service
 */

import {
  TrademarkRegistrationRequest,
  ApplicantType,
  NaturalPersonApplicant,
  LegalEntityApplicant,
} from '../../types/dpma';
import { BaseStep } from './BaseStep';
import { createUrlEncodedBody, AJAX_HEADERS, BASE_URL } from '../http';

export class Step8Final extends BaseStep {
  /**
   * Execute final submission and return the encrypted transaction ID
   */
  async execute(request: TrademarkRegistrationRequest): Promise<string> {
    this.logger.log('Step 8: Final submission...');

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

    // Extract dynamic JSF field IDs from the Step 7 response
    const lastResponse = this.session.getLastResponse();
    const dynamicFields = this.tokenExtractor.extractDynamicFields(lastResponse);
    this.logger.log(`Extracted ${Object.keys(dynamicFields).length} dynamic fields from Step 7 response`);

    const tokens = this.session.getTokens();

    // Build the final submission request
    const allFields = {
      ...fields,
      ...dynamicFields,
      'jakarta.faces.partial.ajax': 'true',
      'jakarta.faces.source': 'btnSubmitRegistration',
      'jakarta.faces.partial.execute': '@all',
      'jakarta.faces.partial.render': 'editor-form',
      'btnSubmitRegistration': 'btnSubmitRegistration',
      'editor-form': 'editor-form',
      'editorPanel_active': 'null',
      'jakarta.faces.ViewState': tokens.viewState,
      'jakarta.faces.ClientWindow': tokens.clientWindow,
      'primefaces.nonce': tokens.primefacesNonce,
    };

    const body = createUrlEncodedBody(allFields);
    const url = this.session.buildFormUrl();

    this.logger.log('Sending final submission...');

    // This request will redirect to the Versand service
    const response = await this.http.post(url, body, {
      headers: {
        ...AJAX_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Referer': `${BASE_URL}${url}`,
      },
      maxRedirects: 0,
    });

    // Check if we got a 302 redirect (expected path)
    if (response.status === 302) {
      const location = response.headers.location as string;
      this.logger.log('Redirect received (302)', location);

      const match = location.match(/transactionId=([^&]+)/);
      if (match) {
        const encryptedTransactionId = decodeURIComponent(match[1]);
        this.session.setTransactionId(encryptedTransactionId);
        this.logger.log('Extracted encrypted transaction ID from redirect');
        return encryptedTransactionId;
      }
      throw new Error('302 redirect received but no transactionId in location header');
    }

    // If not a redirect, check for transaction ID in response body
    if (typeof response.data === 'string') {
      const patterns = [
        /transactionId=([^&"'\s]+)/,
        /transactionId['"]\s*:\s*['"]([^'"]+)/,
        /flowReturn\.xhtml\?[^"']*transactionId=([^&"']+)/,
      ];

      for (const pattern of patterns) {
        const match = response.data.match(pattern);
        if (match) {
          const encryptedTransactionId = decodeURIComponent(match[1]);
          this.session.setTransactionId(encryptedTransactionId);
          this.logger.log('Extracted encrypted transaction ID from response body');
          return encryptedTransactionId;
        }
      }
    }

    this.logger.log('Response status:', response.status);
    this.logger.log('Response headers:', response.headers);
    this.logger.log('Response data (first 500 chars):', typeof response.data === 'string' ? response.data.substring(0, 500) : response.data);

    // Save full response for debugging
    if (typeof response.data === 'string') {
      this.logger.saveFile('step8_final_response.xml', response.data);

      if (this.logger.isEnabled()) {
        // Check for validation errors
        if (response.data.includes('ui-message-error') || response.data.includes('ui-messages-error')) {
          this.logger.log('VALIDATION ERRORS DETECTED in response');
          const errorMatch = response.data.match(/ui-message-error[^>]*>([^<]+)/g);
          if (errorMatch) {
            this.logger.log('Error messages:', errorMatch);
          }
        }

        const titleMatch = response.data.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) {
          this.logger.log('Page title:', titleMatch[1]);
        }
      }
    }

    throw new Error(`Failed to get transaction ID from final submission (status: ${response.status})`);
  }
}
