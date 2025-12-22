/**
 * Step3DeliveryAddress - Handle delivery address submission
 * Supports two modes: copy from applicant or manual entry
 */

import {
  TrademarkRegistrationRequest,
  ApplicantType,
  NaturalPersonApplicant,
  LegalEntityApplicant,
  DPMA_VIEW_IDS,
} from '../../types/dpma';
import { BaseStep } from './BaseStep';
import { mapLegalForm } from '../utils/LegalFormMapper';
import { createUrlEncodedBody, AJAX_HEADERS, BASE_URL } from '../http';

export class Step3DeliveryAddress extends BaseStep {
  async execute(request: TrademarkRegistrationRequest): Promise<void> {
    this.logger.log('Step 3: Submitting delivery address...');

    const { deliveryAddress } = request;

    // Determine if we should use a separate delivery address or copy from applicant
    const useDeliveryAddress = deliveryAddress && !deliveryAddress.copyFromApplicant;

    if (useDeliveryAddress) {
      // Manual fill mode - use provided delivery address
      await this.submitManual(request);
    } else {
      // Copy from applicant mode - use dropdown to auto-populate
      await this.submitFromApplicant(request);
    }

    this.logger.log('Step 3 completed');
  }

  /**
   * Submit delivery address by copying from applicant via dropdown
   */
  private async submitFromApplicant(request: TrademarkRegistrationRequest): Promise<void> {
    const { applicant, email } = request;

    // Construct the dropdown value based on applicant type
    // Format: "1 Anmelder {Name} " where Name is company name or last name
    // IMPORTANT: The DPMA dropdown values have a trailing space!
    let applicantName: string;
    if (applicant.type === ApplicantType.NATURAL) {
      const natural = applicant as NaturalPersonApplicant;
      applicantName = natural.lastName;
    } else {
      const legal = applicant as LegalEntityApplicant;
      applicantName = legal.companyName;
    }
    const dropdownValue = `1 Anmelder ${applicantName} `;

    this.logger.log(`Step 3: Selecting applicant from dropdown: "${dropdownValue}"`);

    // Step 1: Trigger dropdown change to select the applicant
    await this.triggerDeliveryAddressDropdown(dropdownValue);

    // Step 2: Submit the form with ALL fields
    const address = applicant.address;

    const fields: Record<string, string> = {
      'dpmaViewItemIndex': '0',
      'daf-correspondence:address-ref-combo-a:valueHolder_input': dropdownValue,
      'daf-correspondence:addressEntityType': applicant.type === ApplicantType.NATURAL ? 'natural' : 'legal',
      'daf-correspondence:street:valueHolder': address.street,
      'daf-correspondence:addressLine1:valueHolder': address.addressLine1 || '',
      'daf-correspondence:addressLine2:valueHolder': address.addressLine2 || '',
      'daf-correspondence:mailbox:valueHolder': '',
      'daf-correspondence:zip:valueHolder': address.zip,
      'daf-correspondence:city:valueHolder': address.city,
      'daf-correspondence:country:valueHolder_input': address.country,
      'daf-correspondence:phone:valueHolder': '',
      'daf-correspondence:fax:valueHolder': '',
      'daf-correspondence:email:valueHolder': email,
      'editorPanel_active': 'null',
    };

    // Add name fields based on entity type
    if (applicant.type === ApplicantType.NATURAL) {
      const natural = applicant as NaturalPersonApplicant;
      fields['daf-correspondence:lastName:valueHolder'] = natural.lastName;
      fields['daf-correspondence:firstName:valueHolder'] = natural.firstName;
      if (natural.salutation) {
        fields['daf-correspondence:namePrefix:valueHolder_input'] = natural.salutation;
        fields['daf-correspondence:namePrefix:valueHolder_editableInput'] = natural.salutation;
      } else {
        fields['daf-correspondence:namePrefix:valueHolder_focus'] = '';
        fields['daf-correspondence:namePrefix:valueHolder_input'] = '';
        fields['daf-correspondence:namePrefix:valueHolder_editableInput'] = ' ';
      }
      fields['daf-correspondence:nameSuffix:valueHolder'] = '';
    } else {
      const legal = applicant as LegalEntityApplicant;
      fields['daf-correspondence:lastName:valueHolder'] = legal.companyName;
      if (legal.legalForm) {
        const mappedForm = mapLegalForm(legal.legalForm);
        fields['daf-correspondence:namePrefix:valueHolder_input'] = mappedForm;
        fields['daf-correspondence:namePrefix:valueHolder_editableInput'] = mappedForm;
      } else {
        fields['daf-correspondence:namePrefix:valueHolder_focus'] = '';
        fields['daf-correspondence:namePrefix:valueHolder_input'] = '';
        fields['daf-correspondence:namePrefix:valueHolder_editableInput'] = ' ';
      }
    }

    this.logger.log(`Step 3: Using applicant address via dropdown (${applicant.type})`);
    await this.submitStep(fields, DPMA_VIEW_IDS.STEP_3_TO_4);
  }

  /**
   * Trigger the delivery address dropdown change to copy from applicant
   */
  private async triggerDeliveryAddressDropdown(dropdownValue: string): Promise<void> {
    const tokens = this.session.getTokens();

    this.logger.log(`Triggering delivery address dropdown with value: ${dropdownValue}`);

    const fields: Record<string, string> = {
      'jakarta.faces.partial.ajax': 'true',
      'jakarta.faces.source': 'daf-correspondence:address-ref-combo-a:valueHolder',
      'jakarta.faces.behavior.event': 'change',
      'jakarta.faces.partial.execute': 'editor-form',
      'jakarta.faces.partial.render': 'editor-form',
      'daf-correspondence:address-ref-combo-a:valueHolder_input': dropdownValue,
      'editor-form': 'editor-form',
      'dpmaViewItemIndex': '0',
      'editorPanel_active': 'null',
      'jakarta.faces.ViewState': tokens.viewState,
      'jakarta.faces.ClientWindow': tokens.clientWindow,
      'primefaces.nonce': tokens.primefacesNonce,
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

    if (response.data && typeof response.data === 'string') {
      this.session.setLastResponse(response.data);
      this.logger.saveFile('delivery_address_dropdown.xml', response.data);
      const updatedTokens = this.tokenExtractor.updateTokensFromResponse(
        response.data,
        this.session.getTokens()
      );
      this.session.setTokens(updatedTokens);
    }

    this.logger.log('Delivery address dropdown change triggered successfully');
  }

  /**
   * Submit delivery address with manual field entry
   */
  private async submitManual(request: TrademarkRegistrationRequest): Promise<void> {
    const { deliveryAddress } = request;

    if (!deliveryAddress) {
      throw new Error('deliveryAddress is required for manual mode');
    }

    const entityType = deliveryAddress.type;
    const address = deliveryAddress.address;
    const contactEmail = deliveryAddress.contact.email;
    const contactPhone = deliveryAddress.contact.telephone || '';
    const contactFax = deliveryAddress.contact.fax || '';

    // First, trigger a radio button change to set entity type
    await this.triggerEntityTypeChange(entityType);

    // Build delivery address fields
    const fields: Record<string, string> = {
      'dpmaViewItemIndex': '0',
      'daf-correspondence:address-ref-combo-a:valueHolder_input': 'Neue Adresse',
      'daf-correspondence:addressEntityType': entityType === 'natural' ? 'natural' : 'legal',
      'daf-correspondence:street:valueHolder': address.street,
      'daf-correspondence:addressLine1:valueHolder': address.addressLine1 || '',
      'daf-correspondence:addressLine2:valueHolder': address.addressLine2 || '',
      'daf-correspondence:mailbox:valueHolder': '',
      'daf-correspondence:zip:valueHolder': address.zip,
      'daf-correspondence:city:valueHolder': address.city,
      'daf-correspondence:country:valueHolder_input': address.country,
      'daf-correspondence:phone:valueHolder': contactPhone,
      'daf-correspondence:fax:valueHolder': contactFax,
      'daf-correspondence:email:valueHolder': contactEmail,
      'editorPanel_active': 'null',
    };

    // Add name fields based on entity type
    if (entityType === 'natural') {
      fields['daf-correspondence:lastName:valueHolder'] = deliveryAddress.lastName;
      fields['daf-correspondence:firstName:valueHolder'] = deliveryAddress.firstName || '';
      fields['daf-correspondence:nameSuffix:valueHolder'] = '';
      if (deliveryAddress.salutation) {
        fields['daf-correspondence:namePrefix:valueHolder_input'] = deliveryAddress.salutation;
        fields['daf-correspondence:namePrefix:valueHolder_editableInput'] = deliveryAddress.salutation;
      } else {
        fields['daf-correspondence:namePrefix:valueHolder_focus'] = '';
        fields['daf-correspondence:namePrefix:valueHolder_input'] = '';
        fields['daf-correspondence:namePrefix:valueHolder_editableInput'] = ' ';
      }
    } else {
      fields['daf-correspondence:lastName:valueHolder'] = deliveryAddress.companyName || '';
      if (deliveryAddress.legalForm) {
        const mappedForm = mapLegalForm(deliveryAddress.legalForm);
        fields['daf-correspondence:namePrefix:valueHolder_input'] = mappedForm;
        fields['daf-correspondence:namePrefix:valueHolder_editableInput'] = mappedForm;
      } else {
        fields['daf-correspondence:namePrefix:valueHolder_focus'] = '';
        fields['daf-correspondence:namePrefix:valueHolder_input'] = '';
        fields['daf-correspondence:namePrefix:valueHolder_editableInput'] = ' ';
      }
    }

    this.logger.log(`Step 3: Using separate delivery address (${entityType})`);
    await this.submitStep(fields, DPMA_VIEW_IDS.STEP_3_TO_4);
  }

  /**
   * Trigger entity type change for delivery address form
   */
  private async triggerEntityTypeChange(entityType: string): Promise<void> {
    const tokens = this.session.getTokens();
    const radioValue = entityType === 'natural' ? 'natural' : 'legal';

    this.logger.log(`Triggering delivery address entity type change: ${radioValue}`);

    const fields: Record<string, string> = {
      'jakarta.faces.partial.ajax': 'true',
      'jakarta.faces.source': 'daf-correspondence:addressEntityType',
      'jakarta.faces.behavior.event': 'change',
      'jakarta.faces.partial.execute': 'editor-form',
      'jakarta.faces.partial.render': 'editor-form',
      'daf-correspondence:addressEntityType': radioValue,
      'daf-correspondence:address-ref-combo-a:valueHolder_input': 'Neue Adresse',
      'editor-form': 'editor-form',
      'dpmaViewItemIndex': '0',
      'editorPanel_active': 'null',
      'jakarta.faces.ViewState': tokens.viewState,
      'jakarta.faces.ClientWindow': tokens.clientWindow,
      'primefaces.nonce': tokens.primefacesNonce,
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

    if (response.data && typeof response.data === 'string') {
      this.session.setLastResponse(response.data);
      this.logger.saveFile('delivery_entity_type_change.xml', response.data);
      const updatedTokens = this.tokenExtractor.updateTokensFromResponse(
        response.data,
        this.session.getTokens()
      );
      this.session.setTokens(updatedTokens);
    }

    this.logger.log('Delivery address entity type change triggered successfully');
  }
}
