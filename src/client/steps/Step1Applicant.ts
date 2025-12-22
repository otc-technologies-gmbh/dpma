/**
 * Step1Applicant - Submit applicant information (Anmelder)
 */

import {
  TrademarkRegistrationRequest,
  ApplicantType,
  NaturalPersonApplicant,
  LegalEntityApplicant,
  SanctionDeclaration,
  DPMA_VIEW_IDS,
} from '../../types/dpma';
import { BaseStep } from './BaseStep';
import { mapLegalForm } from '../utils/LegalFormMapper';

export class Step1Applicant extends BaseStep {
  async execute(request: TrademarkRegistrationRequest): Promise<void> {
    this.logger.log('Step 1: Submitting applicant information...');

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
      // For legal entities, company name goes into lastName field (Firmenname)
      fields['daf-applicant:lastName:valueHolder'] = legal.companyName;
      // Legal form goes into namePrefix field (Rechtsform/Gesellschaftsform)
      if (legal.legalForm) {
        const mappedForm = mapLegalForm(legal.legalForm);
        // Set both the hidden select AND the visible editable input
        fields['daf-applicant:namePrefix:valueHolder_input'] = mappedForm;
        fields['daf-applicant:namePrefix:valueHolder_editableInput'] = mappedForm;
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
    this.logger.log('Step 1 completed');
  }
}
