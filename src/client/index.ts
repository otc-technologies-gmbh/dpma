/**
 * Client module - Re-exports for backward compatibility
 */

// Main client class
export { DPMAClient } from './DPMAClient';

// HTTP layer
export {
  DPMAHttpClient,
  HttpClientOptions,
  BASE_URL,
  EDITOR_PATH,
  VERSAND_PATH,
  AJAX_HEADERS,
  BROWSER_HEADERS,
  createFormData,
  createUrlEncodedBody,
  addNavigationFields,
} from './http';

// Session management
export {
  SessionManager,
  DPMASessionState,
  TokenExtractor,
} from './session';

// Steps
export {
  BaseStep,
  StepDependencies,
  Step1Applicant,
  Step2Lawyer,
  Step3DeliveryAddress,
  Step4Trademark,
  Step5NiceClasses,
  Step6Options,
  Step7Payment,
  Step8Final,
} from './steps';

// Services
export {
  VersandService,
  DocumentService,
} from './services';

// Utilities
export {
  DebugLogger,
  DebugLoggerOptions,
  mapLegalForm,
  LEGAL_FORM_MAP,
  getCountryDisplayName,
  COUNTRY_MAP,
} from './utils';
