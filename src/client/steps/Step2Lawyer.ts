/**
 * Step2Lawyer - Skip the lawyer/representative step
 */

import { TrademarkRegistrationRequest, DPMA_VIEW_IDS } from '../../types/dpma';
import { BaseStep } from './BaseStep';

export class Step2Lawyer extends BaseStep {
  async execute(_request: TrademarkRegistrationRequest): Promise<void> {
    this.logger.log('Step 2: Skipping lawyer information...');
    await this.submitStep({}, DPMA_VIEW_IDS.STEP_2_TO_3);
    this.logger.log('Step 2 completed');
  }
}
