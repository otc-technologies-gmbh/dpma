/**
 * AjaxHelpers - Form data creation and encoding utilities for DPMA communication
 */

import FormData from 'form-data';
import { JsfTokens } from '../../types/dpma';

/** Request headers for AJAX calls */
export const AJAX_HEADERS = {
  'faces-request': 'partial/ajax',
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'application/xml, text/xml, */*; q=0.01',
};

/** Standard browser headers */
export const BROWSER_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
};

/**
 * Create multipart form data with standard fields (for file uploads)
 */
export function createFormData(fields: Record<string, string>): FormData {
  const form = new FormData();

  // Add all fields
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }

  return form;
}

/**
 * Create URL-encoded body for form submissions (properly handles UTF-8)
 */
export function createUrlEncodedBody(fields: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    params.append(key, value);
  }
  return params.toString();
}

/**
 * Add standard AJAX navigation fields to form data
 */
export function addNavigationFields(
  fields: Record<string, string>,
  dpmaViewId: string,
  tokens: JsfTokens
): Record<string, string> {
  return {
    ...fields,
    'jakarta.faces.partial.ajax': 'true',
    'jakarta.faces.source': 'cmd-link-next',
    'jakarta.faces.partial.execute': 'editor-form',
    'jakarta.faces.partial.render': 'editor-form',
    'cmd-link-next': 'cmd-link-next',
    'dpmaViewId': dpmaViewId,
    'dpmaViewCheck': 'true',
    'editor-form': 'editor-form',
    'jakarta.faces.ViewState': tokens.viewState,
    'jakarta.faces.ClientWindow': tokens.clientWindow,
    'primefaces.nonce': tokens.primefacesNonce,
  };
}
