/**
 * TokenExtractor - Extracts JSF tokens from HTML responses
 */

import * as cheerio from 'cheerio';
import { JsfTokens } from '../../types/dpma';
import { DebugLogger } from '../utils/DebugLogger';

export class TokenExtractor {
  private logger: DebugLogger;

  constructor(logger: DebugLogger) {
    this.logger = logger;
  }

  /**
   * Extract JSF tokens from HTML response
   */
  extractTokens(html: string, jfwidFallback?: string, sessionJfwid?: string): JsfTokens {
    const $ = cheerio.load(html);

    // Extract ViewState - try multiple possible selectors
    let viewState = $('input[name="jakarta.faces.ViewState"]').val() as string;
    if (!viewState) {
      viewState = $('input[id$="ViewState"]').val() as string;
    }
    if (!viewState) {
      // Try to find in script tags or as data attribute
      const match = html.match(/jakarta\.faces\.ViewState['"]\s*(?:value|:)\s*['"]([^'"]+)/);
      if (match) {
        viewState = match[1];
      }
    }
    if (!viewState) {
      this.logger.log('HTML content (first 2000 chars):', html.substring(0, 2000));
      throw new Error('Failed to extract jakarta.faces.ViewState from HTML');
    }

    // Extract ClientWindow (from hidden input or URL)
    // Note: ClientWindow INCLUDES the counter suffix (e.g., "uuid:0")
    let clientWindow = $('input[name="jakarta.faces.ClientWindow"]').val() as string;
    if (!clientWindow) {
      // Try data attribute on form
      clientWindow = $('form').attr('data-client-window') as string;
    }
    if (!clientWindow && jfwidFallback) {
      // Use fallback - include :0 if not already present
      clientWindow = jfwidFallback.includes(':') ? jfwidFallback : `${jfwidFallback}:0`;
    }
    if (!clientWindow && sessionJfwid) {
      // session.jfwid is base jfwid, add :0 for initial form
      clientWindow = `${sessionJfwid}:0`;
    }
    if (!clientWindow) {
      throw new Error('Failed to extract jakarta.faces.ClientWindow');
    }

    // Extract PrimeFaces nonce - the nonce is added dynamically by JavaScript
    // It's passed to PrimeFaces.csp.init('...') in a script tag
    let primefacesNonce = '';

    // Method 1: Extract from PrimeFaces.csp.init() call
    const cspInitMatch = html.match(/PrimeFaces\.csp\.init\(['"]([^'"]+)['"]\)/);
    if (cspInitMatch) {
      primefacesNonce = cspInitMatch[1];
      this.logger.log('Extracted nonce from PrimeFaces.csp.init():', primefacesNonce.substring(0, 20) + '...');
    }

    // Method 2: Try from hidden input (in case page structure changes)
    if (!primefacesNonce) {
      primefacesNonce = $('input[name="primefaces.nonce"]').val() as string || '';
    }

    // Method 3: Extract from script tag nonce attribute
    if (!primefacesNonce) {
      const scriptNonceMatch = html.match(/<script[^>]+nonce=["']([^"']+)["']/);
      if (scriptNonceMatch) {
        primefacesNonce = scriptNonceMatch[1];
        this.logger.log('Extracted nonce from script tag attribute:', primefacesNonce.substring(0, 20) + '...');
      }
    }

    if (!primefacesNonce) {
      this.logger.log('WARNING: primefaces.nonce not found in HTML');
      primefacesNonce = '';
    }

    return { viewState, clientWindow, primefacesNonce };
  }

  /**
   * Extract jfwid from URL or response
   */
  extractJfwid(url: string): string {
    const match = url.match(/jfwid=([^&:]+(?::\d+)?)/);
    if (!match) {
      throw new Error(`Failed to extract jfwid from URL: ${url}`);
    }
    return match[1];
  }

  /**
   * Update tokens from AJAX/HTML response
   */
  updateTokensFromResponse(responseData: string, currentTokens: JsfTokens): JsfTokens {
    const updatedTokens = { ...currentTokens };

    // Extract ViewState
    const viewStateMatch = responseData.match(/jakarta\.faces\.ViewState[^>]*>(?:<!\[CDATA\[)?([^<\]]+)/);
    if (viewStateMatch) {
      updatedTokens.viewState = viewStateMatch[1];
    }

    // Extract ClientWindow
    const clientWindowMatch = responseData.match(/jakarta\.faces\.ClientWindow[^>]*>(?:<!\[CDATA\[)?([^<\]]+)/);
    if (clientWindowMatch) {
      updatedTokens.clientWindow = clientWindowMatch[1];
    }

    // Extract nonce
    const nonceMatch = responseData.match(/PrimeFaces\.csp\.init\(['"]([^'"]+)['"]\)/);
    if (nonceMatch) {
      updatedTokens.primefacesNonce = nonceMatch[1];
    }

    return updatedTokens;
  }

  /**
   * Extract dynamic JSF field IDs from HTML response
   * These are fields like j_idt9679:j_idt9684:itemsPanel_active that change per session
   */
  extractDynamicFields(html: string): Record<string, string> {
    const dynamicFields: Record<string, string> = {};

    // Pattern 1: Match the exact format seen in Chrome DevTools
    const exactPattern = /id="(j_idt\d+[^"]*:itemsPanel_active)"[^>]*name="([^"]+)"[^>]*value="([^"]*)"/g;
    let match;
    while ((match = exactPattern.exec(html)) !== null) {
      const fieldName = match[2];
      const fieldValue = match[3] || '-1';
      dynamicFields[fieldName] = fieldValue;
      this.logger.log(`Found dynamic field (exact): ${fieldName} = ${fieldValue}`);
    }

    // Pattern 2: Match with name first, then value (different attribute order)
    const nameFirstPattern = /name="(j_idt\d+[^"]*:itemsPanel_active)"[^>]*value="([^"]*)"/g;
    while ((match = nameFirstPattern.exec(html)) !== null) {
      const fieldName = match[1];
      const fieldValue = match[2] || '-1';
      if (!dynamicFields[fieldName]) {
        dynamicFields[fieldName] = fieldValue;
        this.logger.log(`Found dynamic field (nameFirst): ${fieldName} = ${fieldValue}`);
      }
    }

    // Pattern 3: Match with value before name (another possible order)
    const valueFirstPattern = /value="([^"]*)"[^>]*name="(j_idt\d+[^"]*:itemsPanel_active)"/g;
    while ((match = valueFirstPattern.exec(html)) !== null) {
      const fieldName = match[2];
      const fieldValue = match[1] || '-1';
      if (!dynamicFields[fieldName]) {
        dynamicFields[fieldName] = fieldValue;
        this.logger.log(`Found dynamic field (valueFirst): ${fieldName} = ${fieldValue}`);
      }
    }

    // Pattern 4: Look in CDATA sections (JSF AJAX responses wrap content in CDATA)
    const cdataPattern = /<!\[CDATA\[[\s\S]*?(?:name|id)="(j_idt\d+[^"]*:itemsPanel_active)"[^>]*value="([^"]*)"/g;
    while ((match = cdataPattern.exec(html)) !== null) {
      const fieldName = match[1];
      const fieldValue = match[2] || '-1';
      if (!dynamicFields[fieldName]) {
        dynamicFields[fieldName] = fieldValue;
        this.logger.log(`Found dynamic field (CDATA): ${fieldName} = ${fieldValue}`);
      }
    }

    // If no itemsPanel_active fields found, log warning but don't fail
    if (Object.keys(dynamicFields).length === 0) {
      this.logger.log('WARNING: No dynamic j_idt*:itemsPanel_active fields found in response');
      // Debug: Log first few j_idt patterns
      const jidtMatches = html.match(/j_idt\d+[^"']*/g);
      if (jidtMatches) {
        this.logger.log('Found j_idt patterns:', jidtMatches.slice(0, 10).join(', '));
      }
    }

    return dynamicFields;
  }
}
