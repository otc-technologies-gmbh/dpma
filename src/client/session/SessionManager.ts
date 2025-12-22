/**
 * SessionManager - Holds and manages DPMA session state
 */

import { JsfTokens } from '../../types/dpma';
import { EDITOR_PATH } from '../http/HttpClient';

/**
 * Complete session state for a DPMA registration session
 */
export interface DPMASessionState {
  /** Base JSF Window ID (without counter) */
  jfwid: string;

  /** Current step counter */
  stepCounter: number;

  /** JSF tokens (ViewState, ClientWindow, nonce) */
  tokens: JsfTokens;

  /** Encrypted transaction ID (after final submit) */
  encryptedTransactionId?: string;

  /** Last response HTML (for dynamic field extraction) */
  lastResponseHtml: string;
}

export class SessionManager {
  private state: DPMASessionState | null = null;

  /**
   * Initialize a new session with the given jfwid and tokens
   */
  initialize(jfwid: string, tokens: JsfTokens): void {
    // Store the base UUID (without counter) for reference
    const baseJfwid = jfwid.split(':')[0];

    this.state = {
      jfwid: baseJfwid,
      stepCounter: 0,
      tokens,
      lastResponseHtml: '',
    };
  }

  /**
   * Check if session is initialized
   */
  isInitialized(): boolean {
    return this.state !== null;
  }

  /**
   * Get the current session state
   * @throws Error if session is not initialized
   */
  getState(): DPMASessionState {
    if (!this.state) {
      throw new Error('Session not initialized');
    }
    return this.state;
  }

  /**
   * Get the base jfwid
   */
  getJfwid(): string {
    return this.getState().jfwid;
  }

  /**
   * Get current tokens
   */
  getTokens(): JsfTokens {
    return this.getState().tokens;
  }

  /**
   * Update tokens (partial update supported)
   */
  updateTokens(newTokens: Partial<JsfTokens>): void {
    const state = this.getState();
    state.tokens = { ...state.tokens, ...newTokens };
  }

  /**
   * Set tokens from a full JsfTokens object
   */
  setTokens(tokens: JsfTokens): void {
    this.getState().tokens = tokens;
  }

  /**
   * Increment the step counter
   */
  incrementStep(): void {
    this.getState().stepCounter++;
  }

  /**
   * Get current step counter
   */
  getStepCounter(): number {
    return this.getState().stepCounter;
  }

  /**
   * Set the last response HTML (for dynamic field extraction)
   */
  setLastResponse(html: string): void {
    this.getState().lastResponseHtml = html;
  }

  /**
   * Get the last response HTML
   */
  getLastResponse(): string {
    return this.getState().lastResponseHtml;
  }

  /**
   * Set the encrypted transaction ID (after final submission)
   */
  setTransactionId(id: string): void {
    this.getState().encryptedTransactionId = id;
  }

  /**
   * Get the encrypted transaction ID
   */
  getTransactionId(): string | undefined {
    return this.getState().encryptedTransactionId;
  }

  /**
   * Build the form URL with current session parameters
   * The jfwid in the URL must match the jakarta.faces.ClientWindow value
   */
  buildFormUrl(): string {
    const state = this.getState();
    // Use the ClientWindow value which includes the correct counter suffix
    const clientWindow = state.tokens.clientWindow;
    return `${EDITOR_PATH}/w7005/w7005web.xhtml?jftfdi=&jffi=w7005&jfwid=${clientWindow}`;
  }
}
