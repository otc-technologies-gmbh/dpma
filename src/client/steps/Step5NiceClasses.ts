/**
 * Step5NiceClasses - Handle Nice classification selection
 * This is the most complex step, handling class expansion, search, and checkbox selection
 */

import {
  TrademarkRegistrationRequest,
  DPMA_VIEW_IDS,
} from '../../types/dpma';
import { BaseStep } from './BaseStep';
import { createUrlEncodedBody, AJAX_HEADERS, BASE_URL } from '../http';

export class Step5NiceClasses extends BaseStep {
  async execute(request: TrademarkRegistrationRequest): Promise<void> {
    this.logger.log('Step 5: Submitting Nice classification...');

    const { niceClasses, leadClass } = request;

    // Set lead class (defaults to first selected class)
    const effectiveLeadClass = leadClass ?? niceClasses[0]?.classNumber ?? 9;

    // Collect all checkbox IDs
    const selectedCheckboxIds: string[] = [];

    // Process each Nice class selection
    for (const niceClass of niceClasses) {
      const classNum = niceClass.classNumber;
      const hasSpecificTerms = niceClass.terms && niceClass.terms.length > 0;
      const selectHeader = niceClass.selectClassHeader ?? !hasSpecificTerms;

      this.logger.log(`Processing Nice class ${classNum}...`);
      this.logger.log(`  - Has specific terms: ${hasSpecificTerms}`);
      this.logger.log(`  - Select class header: ${selectHeader}`);

      try {
        if (hasSpecificTerms) {
          // Term-based selection: Search and select specific terms
          this.logger.log(`Selecting ${niceClass.terms!.length} specific terms for class ${classNum}...`);

          const termCheckboxIds = await this.selectTermsBySearch(niceClass.terms!);
          selectedCheckboxIds.push(...termCheckboxIds);

          this.logger.log(`Successfully selected ${termCheckboxIds.length}/${niceClass.terms!.length} terms`);
        }

        if (selectHeader || !hasSpecificTerms) {
          // Class header selection: Select the entire class header
          this.logger.log(`Selecting class header for class ${classNum}...`);

          // Step 1: Expand the class tree to load subcategories
          const expandResponse = await this.expandClass(classNum);

          // Step 2: Parse the response to find checkbox IDs
          const checkboxId = this.findFirstCheckboxId(expandResponse, classNum);

          if (checkboxId) {
            this.logger.log(`Found checkbox for class ${classNum}: ${checkboxId}`);
            selectedCheckboxIds.push(checkboxId);

            // CRITICAL: Trigger the checkbox change event
            await this.triggerCheckboxChange(checkboxId);
          } else {
            this.logger.log(`Warning: Could not find checkbox for class ${classNum}, trying alternative method...`);

            // Alternative: Try to select at class level
            const classCheckboxId = await this.findClassLevelCheckbox(classNum);
            if (classCheckboxId) {
              selectedCheckboxIds.push(classCheckboxId);
              await this.triggerCheckboxChange(classCheckboxId);
              this.logger.log(`Using class-level checkbox: ${classCheckboxId}`);
            } else {
              this.logger.log(`Warning: No checkbox found for class ${classNum}`);
            }
          }
        }
      } catch (error: any) {
        this.logger.log(`Error processing class ${classNum}: ${error.message}`);
        // Continue with other classes
      }
    }

    // Build the final form fields - include all selected checkboxes
    const fields: Record<string, string> = {};
    for (const checkboxId of selectedCheckboxIds) {
      fields[checkboxId] = 'on';
    }
    fields['tmclassEditorGt:leadingClassCombo_input'] = String(effectiveLeadClass);

    this.logger.log(`Submitting Nice classes with ${selectedCheckboxIds.length} selections`);
    this.logger.log('Selected checkboxes:', selectedCheckboxIds);

    await this.submitStep(fields, DPMA_VIEW_IDS.STEP_5_TO_6);
    this.logger.log('Step 5 completed');
  }

  /**
   * Expand a Nice class tree node to load its subcategories
   */
  private async expandClass(classNumber: number): Promise<string> {
    const tokens = this.session.getTokens();
    const url = this.session.buildFormUrl();

    const expandButtonId = `tmclassEditorGt:tmclassNode_${classNumber}:iconExpandedState`;
    const expandFields: Record<string, string> = {
      'jakarta.faces.partial.ajax': 'true',
      'jakarta.faces.source': expandButtonId,
      'jakarta.faces.partial.execute': expandButtonId,
      'jakarta.faces.partial.render': 'tmclassEditorGt',
      'jakarta.faces.behavior.event': 'action',
      [expandButtonId]: expandButtonId,
      'editor-form': 'editor-form',
      'jakarta.faces.ViewState': tokens.viewState,
      'jakarta.faces.ClientWindow': tokens.clientWindow,
      'primefaces.nonce': tokens.primefacesNonce,
    };

    const body = createUrlEncodedBody(expandFields);

    const response = await this.http.post(url, body, {
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
        this.session.updateTokens({ viewState: viewStateMatch[1] });
      }
    }

    return response.data;
  }

  /**
   * Trigger a Nice class checkbox change event via AJAX
   */
  private async triggerCheckboxChange(checkboxId: string): Promise<void> {
    const tokens = this.session.getTokens();

    // The checkbox ID format is: tmclassEditorGt:tmclassNode_9:j_idt2281:selectBox_input
    // For the change event source, we need: tmclassEditorGt:tmclassNode_9:j_idt2281:selectBox
    const selectBoxId = checkboxId.replace('_input', '');

    this.logger.log(`Triggering checkbox change for ${selectBoxId}`);

    const fields: Record<string, string> = {
      'jakarta.faces.partial.ajax': 'true',
      'jakarta.faces.source': selectBoxId,
      'jakarta.faces.behavior.event': 'change',
      'jakarta.faces.partial.execute': selectBoxId,
      'jakarta.faces.partial.render': `${selectBoxId} @(.termViewCol) @(.tmClassEditorSelected) @(.leadingClassCombo) @(.hintSelectGroup)`,
      [checkboxId]: 'on',
      'editor-form': 'editor-form',
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
      this.logger.saveFile('checkbox_change.xml', response.data);

      const updatedTokens = this.tokenExtractor.updateTokensFromResponse(
        response.data,
        this.session.getTokens()
      );
      this.session.setTokens(updatedTokens);
    }

    this.logger.log('Checkbox change event triggered successfully');
  }

  /**
   * Search for Nice class terms using the DPMA search functionality
   */
  private async searchTerms(searchQuery: string): Promise<string> {
    const tokens = this.session.getTokens();
    const url = this.session.buildFormUrl();

    const searchFields: Record<string, string> = {
      'jakarta.faces.partial.ajax': 'true',
      'jakarta.faces.source': 'tmclassEditorGt:searchWDVZ',
      'jakarta.faces.partial.execute': 'tmclassEditorGt',
      'jakarta.faces.partial.render': 'tmclassEditorGt:nodeTreeAndTermView',
      'tmclassEditorGt:searchWDVZ': 'tmclassEditorGt:searchWDVZ',
      'editor-form': 'editor-form',
      'tmclassEditorGt:tmClassEditorCenterSearchPhrase': searchQuery,
      'tmclassEditorGt:j_idt932_active': 'null',
      'editorPanel_active': 'null',
      'jakarta.faces.ViewState': tokens.viewState,
      'jakarta.faces.ClientWindow': tokens.clientWindow,
      'primefaces.nonce': tokens.primefacesNonce,
    };

    const body = createUrlEncodedBody(searchFields);

    this.logger.log(`Searching Nice terms for: "${searchQuery}"`);

    const response = await this.http.post(url, body, {
      headers: {
        ...AJAX_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Referer': `${BASE_URL}${url}`,
      },
    });

    if (response.data && typeof response.data === 'string') {
      const viewStateMatch = response.data.match(/jakarta\.faces\.ViewState[^>]*>(?:<!\[CDATA\[)?([^<\]]+)/);
      if (viewStateMatch) {
        this.session.updateTokens({ viewState: viewStateMatch[1] });
      }

      if (this.logger.isEnabled()) {
        this.logger.saveFile(`search_${searchQuery.replace(/[^a-zA-Z0-9]/g, '_')}.xml`, response.data);
      }
    }

    return response.data;
  }

  /**
   * Find checkbox IDs matching specific term names from the AJAX response
   */
  private findCheckboxesByTermNames(htmlResponse: string, termNames: string[]): Map<string, string> {
    const results = new Map<string, string>();

    // Primary pattern: Find links with termViewLink in ID and title attribute
    const termViewLinkPattern = /id="(tmclassEditorGt:[^"]+):termViewLink"[^>]*title="([^"]+)"/g;

    let match;
    while ((match = termViewLinkPattern.exec(htmlResponse)) !== null) {
      const prefix = match[1];
      const title = match[2];

      for (const termName of termNames) {
        if (title === termName || title.startsWith(termName)) {
          const checkboxId = `${prefix}:selectBox_input`;
          results.set(termName, checkboxId);
          this.logger.log(`Found checkbox for term "${termName}": ${checkboxId}`);
          break;
        }
      }
    }

    // Alternative pattern: Sometimes the title might have different attribute order
    const altPattern = /title="([^"]+)"[^>]*id="(tmclassEditorGt:[^"]+):termViewLink"/g;
    while ((match = altPattern.exec(htmlResponse)) !== null) {
      const title = match[1];
      const prefix = match[2];

      for (const termName of termNames) {
        if (!results.has(termName) && (title === termName || title.startsWith(termName))) {
          const checkboxId = `${prefix}:selectBox_input`;
          results.set(termName, checkboxId);
          this.logger.log(`Found checkbox (alt) for term "${termName}": ${checkboxId}`);
          break;
        }
      }
    }

    // Debug logging
    if (results.size === 0 && termNames.length > 0) {
      this.logger.log('DEBUG: No term checkboxes found. Looking for termViewLink patterns...');
      const debugPattern = /id="(tmclassEditorGt:[^"]+:termViewLink)"[^>]*title="([^"]{0,50})"/g;
      let count = 0;
      while ((match = debugPattern.exec(htmlResponse)) !== null && count < 5) {
        this.logger.log(`  Found link: ${match[1]} -> "${match[2]}"`);
        count++;
      }
    }

    return results;
  }

  /**
   * Select Nice class terms by searching for them
   */
  private async selectTermsBySearch(terms: string[]): Promise<string[]> {
    const selectedCheckboxIds: string[] = [];

    for (const term of terms) {
      this.logger.log(`Searching for term: "${term}"...`);

      try {
        const searchResponse = await this.searchTerms(term);
        const checkboxMap = this.findCheckboxesByTermNames(searchResponse, [term]);

        if (checkboxMap.has(term)) {
          const checkboxId = checkboxMap.get(term)!;
          selectedCheckboxIds.push(checkboxId);
          await this.triggerCheckboxChange(checkboxId);
          this.logger.log(`Selected term "${term}" with checkbox: ${checkboxId}`);
        } else {
          this.logger.log(`Warning: Could not find checkbox for term "${term}"`);

          // Try a partial match
          const partialMatch = this.findPartialMatchCheckbox(searchResponse, term);
          if (partialMatch) {
            selectedCheckboxIds.push(partialMatch);
            await this.triggerCheckboxChange(partialMatch);
            this.logger.log(`Selected term "${term}" with partial match: ${partialMatch}`);
          }
        }
      } catch (error: any) {
        this.logger.log(`Error selecting term "${term}": ${error.message}`);
      }
    }

    return selectedCheckboxIds;
  }

  /**
   * Find the first checkbox ID from an expanded class response
   */
  private findFirstCheckboxId(htmlResponse: string, classNumber: number): string | null {
    const patterns = [
      new RegExp(`(tmclassEditorGt:tmclassNode_${classNumber}:[^:]+:selectBox_input)`, 'g'),
      new RegExp(`(tmclassEditorGt:[^"']*tmclassNode[^"']*${classNumber}[^"']*selectBox[^"']*)`, 'g'),
      new RegExp(`name="(tmclassEditorGt:[^"]*:selectBox_input)"`, 'g'),
    ];

    for (const pattern of patterns) {
      const matches = htmlResponse.match(pattern);
      if (matches && matches.length > 0) {
        let fieldName = matches[0];
        if (fieldName.startsWith('name="')) {
          fieldName = fieldName.replace('name="', '').replace('"', '');
        }
        return fieldName;
      }
    }

    // Also try to find ui-chkbox elements with IDs
    const checkboxIdPattern = /id="([^"]*tmclassNode[^"]*checkbox[^"]*)"/gi;
    const idMatches = htmlResponse.match(checkboxIdPattern);
    if (idMatches && idMatches.length > 0) {
      const id = idMatches[0].replace('id="', '').replace('"', '');
      return id.replace('_checkbox', ':selectBox_input');
    }

    return null;
  }

  /**
   * Try to find a class-level checkbox
   */
  private async findClassLevelCheckbox(classNumber: number): Promise<string | null> {
    const possibleIds = [
      `tmclassEditorGt:tmclassNode_${classNumber}:selectBox_input`,
      `tmclassEditorGt:tmclassEditorTree:${classNumber - 1}:selectBox_input`,
      `tmclassEditorGt:classSelect_${classNumber}_input`,
    ];

    return possibleIds[0];
  }

  /**
   * Try to find a checkbox by partial term match in the response
   */
  private findPartialMatchCheckbox(htmlResponse: string, termName: string): string | null {
    const normalizedTerm = termName.toLowerCase();
    const pattern = /id="(tmclassEditorGt:[^"]+):termViewLink"[^>]*title="([^"]+)"/g;

    let match;
    while ((match = pattern.exec(htmlResponse)) !== null) {
      const prefix = match[1];
      const title = match[2].toLowerCase();

      if (title.includes(normalizedTerm)) {
        return `${prefix}:selectBox_input`;
      }
    }

    return null;
  }
}
