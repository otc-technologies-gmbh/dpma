/**
 * VersandService - Complete submission via the DPMA Versand dispatch service
 */

import { VersandResponse } from '../../types/dpma';
import { DPMAHttpClient, BASE_URL, VERSAND_PATH, BROWSER_HEADERS, EDITOR_PATH } from '../http';
import { DebugLogger } from '../utils/DebugLogger';

export class VersandService {
  private http: DPMAHttpClient;
  private logger: DebugLogger;

  constructor(http: DPMAHttpClient, logger: DebugLogger) {
    this.http = http;
    this.logger = logger;
  }

  /**
   * Complete the submission via the Versand service
   */
  async complete(encryptedTransactionId: string): Promise<VersandResponse> {
    this.logger.log('Completing submission via Versand service...');

    // Step 1: Load the Versand page (Vue.js app)
    const versandUrl = `${VERSAND_PATH}/index.html?flowId=w7005&transactionId=${encodeURIComponent(encryptedTransactionId)}`;
    await this.http.get(versandUrl, {
      headers: {
        ...BROWSER_HEADERS,
        'Referer': `${BASE_URL}${EDITOR_PATH}/flowReturn.xhtml`,
      },
    });

    // Step 2: POST to complete the submission (empty body!)
    const submitUrl = `${VERSAND_PATH}/versand?flowId=w7005&transactionId=${encodeURIComponent(encryptedTransactionId)}`;
    const response = await this.http.post(submitUrl, '', {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Length': '0',
        'Origin': BASE_URL,
        'Referer': `${BASE_URL}${versandUrl}`,
      },
    });

    const versandResponse = response.data as VersandResponse;
    this.logger.log('Versand response', versandResponse);

    if (versandResponse.status !== 'VERSAND_SUCCESS') {
      throw new Error(`Versand failed: ${versandResponse.validationResult?.userMessage || 'Unknown error'}`);
    }

    return versandResponse;
  }
}
