/**
 * HttpClient - Encapsulates all HTTP communication with DPMA
 */

import axios, { AxiosInstance, AxiosResponse, AxiosRequestConfig } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import FormData from 'form-data';
import { BROWSER_HEADERS } from './AjaxHelpers';

/** Base URLs for DPMA services */
export const BASE_URL = 'https://direkt.dpma.de';
export const EDITOR_PATH = '/DpmaDirektWebEditoren';
export const VERSAND_PATH = '/DpmaDirektWebVersand';

export interface HttpClientOptions {
  debug?: boolean;
}

export class DPMAHttpClient {
  private client: AxiosInstance;
  private cookieJar: CookieJar;

  constructor(options: HttpClientOptions = {}) {
    this.cookieJar = new CookieJar();

    // Create axios instance with cookie support
    this.client = wrapper(axios.create({
      baseURL: BASE_URL,
      jar: this.cookieJar,
      withCredentials: true,
      headers: BROWSER_HEADERS,
      maxRedirects: 0, // Handle redirects manually for better control
      validateStatus: (status) => status >= 200 && status < 400,
    }));
  }

  /**
   * Perform a GET request
   */
  async get(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    return this.client.get(url, config);
  }

  /**
   * Perform a POST request
   */
  async post(
    url: string,
    data?: string | Buffer | FormData | any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse> {
    return this.client.post(url, data, config);
  }

  /**
   * Get the cookie jar (for session persistence inspection)
   */
  getCookieJar(): CookieJar {
    return this.cookieJar;
  }

  /**
   * Get the base URL
   */
  getBaseUrl(): string {
    return BASE_URL;
  }
}
