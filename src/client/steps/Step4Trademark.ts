/**
 * Step4Trademark - Submit trademark information and handle image uploads
 */

import FormData from 'form-data';
import {
  TrademarkRegistrationRequest,
  TrademarkType,
  DPMA_VIEW_IDS,
} from '../../types/dpma';
import { BaseStep } from './BaseStep';
import { createUrlEncodedBody, AJAX_HEADERS, BASE_URL, EDITOR_PATH } from '../http';

export class Step4Trademark extends BaseStep {
  async execute(request: TrademarkRegistrationRequest): Promise<void> {
    this.logger.log('Step 4: Submitting trademark information...');

    const { trademark } = request;

    // Determine the dropdown value based on trademark type
    let dropdownValue: string;
    let requiresImageUpload = false;

    switch (trademark.type) {
      case TrademarkType.WORD:
        dropdownValue = 'word';
        break;
      case TrademarkType.FIGURATIVE:
        dropdownValue = 'image';
        requiresImageUpload = true;
        break;
      case TrademarkType.COMBINED:
        dropdownValue = 'figurative';
        requiresImageUpload = true;
        break;
      case TrademarkType.THREE_DIMENSIONAL:
        dropdownValue = 'spatial';
        requiresImageUpload = true;
        break;
      case TrademarkType.COLOR:
        throw new Error('Color trademark not yet implemented');
      case TrademarkType.SOUND:
        throw new Error('Sound trademark not yet implemented');
      case TrademarkType.POSITION:
        throw new Error('Position trademark not yet implemented');
      case TrademarkType.PATTERN:
        throw new Error('Pattern trademark not yet implemented');
      case TrademarkType.MOTION:
        throw new Error('Motion trademark not yet implemented');
      case TrademarkType.MULTIMEDIA:
        throw new Error('Multimedia trademark not yet implemented');
      case TrademarkType.HOLOGRAM:
        throw new Error('Hologram trademark not yet implemented');
      case TrademarkType.THREAD:
        throw new Error('Thread trademark (Kennfadenmarke) not yet implemented');
      case TrademarkType.OTHER:
        throw new Error('Other trademark type not yet implemented');
    }

    // Step 4a: First trigger the dropdown change event
    await this.triggerDropdownChange('markFeatureCombo:valueHolder', dropdownValue, {
      'dpmaViewItemIndex': '0',
    });

    // Step 4b: For image marks, upload the image file
    if (requiresImageUpload) {
      if (!('imageData' in trademark) || !trademark.imageData) {
        throw new Error(`Image data is required for ${trademark.type} trademark`);
      }
      await this.uploadImage(
        trademark.imageData,
        trademark.imageMimeType,
        trademark.imageFileName
      );
    }

    // Step 4c: Submit the full form with the trademark data
    const trademarkText = trademark.type === TrademarkType.WORD ? trademark.text : '';
    const fields: Record<string, string> = {
      'dpmaViewItemIndex': '0',
      'editorPanel_active': 'null',
      'markFeatureCombo:valueHolder_input': dropdownValue,
      'mark-verbalText:valueHolder': trademarkText,
      'mark-docRefNumber:valueHolder': request.internalReference || '',
    };

    // Add color elements if specified
    if (trademark.colorElements && trademark.colorElements.length > 0) {
      fields['mark-colorElementsHiddenCheckbox_input'] = 'on';
      fields['mark-colorElements:valueHolder'] = trademark.colorElements.join(', ');
    }

    // Add non-Latin characters flag if specified
    if (trademark.hasNonLatinCharacters) {
      fields['mark-nonLatinCharactersCheckBox_input'] = 'on';
    }

    // Add trademark description if specified
    if (trademark.description) {
      fields['mark-description:valueHolder'] = trademark.description;
    }

    await this.submitStep(fields, DPMA_VIEW_IDS.STEP_4_TO_5);
    this.logger.log('Step 4 completed');
  }

  /**
   * Upload an image file for image/combined trademarks
   */
  private async uploadImage(imageData: Buffer, mimeType: string, fileName: string): Promise<void> {
    const tokens = this.session.getTokens();

    this.logger.log(`Uploading trademark image: ${fileName} (${mimeType}, ${imageData.length} bytes)`);

    // Step 1: Navigate to the upload page by triggering the upload button
    const uploadButtonFields: Record<string, string> = {
      'jakarta.faces.partial.ajax': 'true',
      'jakarta.faces.source': 'editor-form:mark-image:markAttachmentsPanelAdd',
      'jakarta.faces.partial.execute': '@all',
      'jakarta.faces.partial.render': '@all',
      'editor-form:mark-image:markAttachmentsPanelAdd': 'editor-form:mark-image:markAttachmentsPanelAdd',
      'editor-form': 'editor-form',
      'dpmaViewItemIndex': '0',
      'jakarta.faces.ViewState': tokens.viewState,
      'jakarta.faces.ClientWindow': tokens.clientWindow,
      'primefaces.nonce': tokens.primefacesNonce,
    };

    const uploadDialogUrl = this.session.buildFormUrl();
    const uploadDialogBody = createUrlEncodedBody(uploadButtonFields);

    const uploadDialogResponse = await this.http.post(uploadDialogUrl, uploadDialogBody, {
      headers: {
        ...AJAX_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Referer': `${BASE_URL}${uploadDialogUrl}`,
      },
    });

    // Extract tokens from response
    if (uploadDialogResponse.data && typeof uploadDialogResponse.data === 'string') {
      this.session.setLastResponse(uploadDialogResponse.data);
      this.logger.saveFile('upload_dialog.xml', uploadDialogResponse.data);
      const updatedTokens = this.tokenExtractor.updateTokensFromResponse(
        uploadDialogResponse.data,
        this.session.getTokens()
      );
      this.session.setTokens(updatedTokens);
    }

    // Step 2: Upload the actual file via multipart/form-data
    const currentTokens = this.session.getTokens();
    const uploadUrl = `${EDITOR_PATH}/w7005/w7005-upload.xhtml?jfwid=${currentTokens.clientWindow}`;

    // Create form data for file upload
    const formData = new FormData();
    formData.append('mainupload:webUpload', 'mainupload:webUpload');
    formData.append('mainupload:webUpload:screenSizeForCalculation', '1296');
    formData.append('jakarta.faces.ViewState', currentTokens.viewState);
    formData.append('jakarta.faces.ClientWindow', currentTokens.clientWindow);
    formData.append('primefaces.nonce', currentTokens.primefacesNonce);

    // Ensure the file is a JPG (DPMA only accepts .jpg)
    let uploadFileName = fileName;
    if (!fileName.toLowerCase().endsWith('.jpg') && !fileName.toLowerCase().endsWith('.jpeg')) {
      uploadFileName = fileName.replace(/\.[^.]+$/, '.jpg');
    }

    formData.append('mainupload:webUpload:webFileUpload_input', imageData, {
      filename: uploadFileName,
      contentType: 'image/jpeg',
    });

    this.logger.log(`Uploading to ${uploadUrl}...`);

    const uploadResponse = await this.http.post(uploadUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        'Referer': `${BASE_URL}${uploadUrl}`,
      },
    });

    this.logger.saveFile('upload_response.html', uploadResponse.data);

    // Extract updated tokens from the upload response
    if (uploadResponse.data && typeof uploadResponse.data === 'string') {
      this.session.setLastResponse(uploadResponse.data);
      const updatedTokens = this.tokenExtractor.updateTokensFromResponse(
        uploadResponse.data,
        this.session.getTokens()
      );
      this.session.setTokens(updatedTokens);

      // Check for upload errors
      if (uploadResponse.data.includes('Fehler') || uploadResponse.data.includes('error')) {
        this.logger.log('Warning: Upload response may contain errors');
      }
    }

    this.logger.log('Image upload completed successfully');
  }
}
