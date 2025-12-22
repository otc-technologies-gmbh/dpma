/**
 * Step7Payment - Submit payment method selection (Zahlung)
 */

import { TrademarkRegistrationRequest, PaymentMethod, DPMA_VIEW_IDS } from '../../types/dpma';
import { BaseStep } from './BaseStep';

export class Step7Payment extends BaseStep {
  async execute(request: TrademarkRegistrationRequest): Promise<void> {
    this.logger.log('Step 7: Submitting payment information...');

    const fields: Record<string, string> = {
      'paymentForm:paymentTypeSelectOneRadio': request.paymentMethod,
    };

    if (request.paymentMethod === PaymentMethod.SEPA_DIRECT_DEBIT && request.sepaDetails) {
      // SEPA fields - exact names TBD
      this.logger.log('SEPA details provided (field names TBD)');
    }

    const responseHtml = await this.submitStep(fields, DPMA_VIEW_IDS.STEP_7_TO_8);
    this.logger.log('Step 7 completed');

    // Debug: Save Step 7 response (which should be Step 8 page)
    this.logger.saveFile('step7_payment_response.xml', responseHtml);
    if (this.logger.isEnabled()) {
      this.logger.log('Step 7 response length:', responseHtml.length);
      if (responseHtml.includes('itemsPanel')) {
        this.logger.log('Step 7 response CONTAINS "itemsPanel"');
      } else {
        this.logger.log('Step 7 response does NOT contain "itemsPanel"');
      }
    }
  }
}
