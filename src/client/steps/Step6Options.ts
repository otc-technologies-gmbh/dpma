/**
 * Step6Options - Submit additional options (Sonstiges)
 */

import { TrademarkRegistrationRequest, DPMA_VIEW_IDS } from '../../types/dpma';
import { BaseStep } from './BaseStep';

export class Step6Options extends BaseStep {
  async execute(request: TrademarkRegistrationRequest): Promise<void> {
    this.logger.log('Step 6: Submitting additional options...');

    const fields: Record<string, string> = {};
    const { options } = request;

    if (options) {
      if (options.acceleratedExamination) {
        fields['acceleratedExamination:valueHolder_input'] = 'on';
        this.logger.log('Accelerated examination requested');
      }
      if (options.certificationMark) {
        fields['mark-certification-chkbox:valueHolder_input'] = 'on';
        this.logger.log('Certification mark requested');
      }
      if (options.licensingDeclaration) {
        fields['mark-licenseIndicator-chkbox:valueHolder_input'] = 'on';
        this.logger.log('Licensing declaration requested');
      }
      if (options.saleDeclaration) {
        fields['mark-dispositionIndicator-chkbox:valueHolder_input'] = 'on';
        this.logger.log('Sale declaration requested');
      }
    }

    await this.submitStep(fields, DPMA_VIEW_IDS.STEP_6_TO_7);
    this.logger.log('Step 6 completed');
  }
}
