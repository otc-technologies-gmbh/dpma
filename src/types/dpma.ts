/**
 * DPMA Trademark Registration API Types
 * Complete type definitions for the German Patent and Trademark Office automation
 */

// ============================================================================
// ENUMS
// ============================================================================

/** Applicant type - natural person or legal entity */
export enum ApplicantType {
  NATURAL = 'natural',
  LEGAL = 'legal'
}

/** Trademark type codes as used by DPMA */
export enum TrademarkType {
  WORD = 'word',                    // Wortmarke
  FIGURATIVE = 'figurative',        // Bildmarke
  COMBINED = 'combined',            // Wort-/Bildmarke
  THREE_DIMENSIONAL = '3d',         // Dreidimensionale Marke
  COLOR = 'color',                  // Farbmarke
  SOUND = 'sound',                  // Klangmarke
  POSITION = 'position',            // Positionsmarke
  PATTERN = 'pattern',              // Mustermarke
  MOTION = 'motion',                // Bewegungsmarke
  MULTIMEDIA = 'multimedia',        // Multimediamarke
  HOLOGRAM = 'hologram',            // Hologrammmarke
  OTHER = 'other'                   // Sonstige Marke
}

/** Payment method */
export enum PaymentMethod {
  BANK_TRANSFER = 'UEBERWEISUNG',
  SEPA_DIRECT_DEBIT = 'SEPASDD'
}

/** Russia sanctions declaration values */
export enum SanctionDeclaration {
  FALSE = 'FALSE',
  TRUE = 'TRUE'
}

// ============================================================================
// INPUT TYPES (API Request)
// ============================================================================

/** Address information */
export interface Address {
  street: string;              // Street + house number
  addressLine1?: string;       // Additional address line
  addressLine2?: string;       // Additional address line 2
  zip: string;                 // Postal code
  city: string;                // City
  country: string;             // ISO country code (e.g., 'DE')
}

/** Natural person applicant */
export interface NaturalPersonApplicant {
  type: ApplicantType.NATURAL;
  salutation?: string;         // Anrede/Titel (optional)
  firstName: string;           // Vorname
  lastName: string;            // Nachname
  nameSuffix?: string;         // Name suffix (optional)
  address: Address;
}

/** Legal entity applicant */
export interface LegalEntityApplicant {
  type: ApplicantType.LEGAL;
  companyName: string;         // Firma/Organisation
  legalForm?: string;          // Rechtsform (GmbH, AG, etc.)
  address: Address;
}

/** Union of applicant types */
export type Applicant = NaturalPersonApplicant | LegalEntityApplicant;

/** Russia sanctions declaration */
export interface SanctionsDeclaration {
  hasRussianNationality: boolean;
  hasRussianResidence: boolean;
}

/** Word trademark */
export interface WordTrademark {
  type: TrademarkType.WORD;
  text: string;                // The trademark text
}

/** Image trademark */
export interface ImageTrademark {
  type: TrademarkType.FIGURATIVE;
  imageData: Buffer;           // Image file data
  imageMimeType: string;       // e.g., 'image/png', 'image/jpeg'
  imageFileName: string;       // Original filename
}

/** Combined word/image trademark */
export interface CombinedTrademark {
  type: TrademarkType.COMBINED;
  text: string;                // The trademark text
  imageData: Buffer;           // Image file data
  imageMimeType: string;       // e.g., 'image/png', 'image/jpeg'
  imageFileName: string;       // Original filename
}

/** Union of trademark types (expandable for other types) */
export type Trademark = WordTrademark | ImageTrademark | CombinedTrademark;

/** Nice classification selection */
export interface NiceClassSelection {
  classNumber: number;         // 1-45
  terms?: string[];            // Specific terms (optional, uses class header if empty)
}

/** Priority claim (optional) */
export interface PriorityClaim {
  type: 'union' | 'exhibition';
  date: string;                // ISO date string
  country?: string;            // For union priority
  applicationNumber?: string;  // For union priority
  exhibitionName?: string;     // For exhibition priority
}

/** SEPA direct debit details (required if payment method is SEPA) */
export interface SepaDetails {
  iban: string;
  bic: string;
  accountHolder: string;
}

/** Additional options for Step 6 */
export interface AdditionalOptions {
  acceleratedExamination?: boolean;    // Beschleunigte Prüfung (+€200)
  certificationMark?: boolean;         // Gewährleistungsmarke
  licensingDeclaration?: boolean;      // Lizenzierung
  saleDeclaration?: boolean;           // Veräußerung
  priorityClaims?: PriorityClaim[];
}

/** Complete trademark registration request */
export interface TrademarkRegistrationRequest {
  /** Applicant information */
  applicant: Applicant;

  /** Sanctions declaration (required for all applicants) */
  sanctions: SanctionsDeclaration;

  /** Email address for correspondence */
  email: string;

  /** The trademark to register */
  trademark: Trademark;

  /** Nice classification classes to register */
  niceClasses: NiceClassSelection[];

  /** Lead class suggestion (defaults to first class) */
  leadClass?: number;

  /** Additional options (Step 6) */
  options?: AdditionalOptions;

  /** Payment method */
  paymentMethod: PaymentMethod;

  /** SEPA details (required if paymentMethod is SEPA_DIRECT_DEBIT) */
  sepaDetails?: SepaDetails;

  /** Internal document reference (optional) */
  internalReference?: string;
}

// ============================================================================
// OUTPUT TYPES (API Response)
// ============================================================================

/** Fee breakdown */
export interface FeeItem {
  code: string;                // e.g., '331000'
  description: string;         // e.g., 'Anmeldeverfahren - bei elektronischer Anmeldung'
  amount: number;              // e.g., 290.00
}

/** Payment information */
export interface PaymentInfo {
  method: PaymentMethod;
  totalAmount: number;
  currency: string;
  bankDetails?: {
    recipient: string;
    iban: string;
    bic: string;
    reference: string;         // Aktenzeichen as payment reference
  };
}

/** Downloaded document */
export interface DownloadedDocument {
  filename: string;
  data: Buffer;
  mimeType: string;
}

/** Successful registration result */
export interface TrademarkRegistrationSuccess {
  success: true;

  /** Official file number (Aktenzeichen) - CRITICAL */
  aktenzeichen: string;

  /** Document reference number (DRN) - CRITICAL */
  drn: string;

  /** Internal transaction ID */
  transactionId: string;

  /** Submission timestamp */
  submissionTime: string;

  /** Fee information */
  fees: FeeItem[];

  /** Payment details */
  payment: PaymentInfo;

  /** All downloaded receipt documents (extracted from ZIP) */
  receiptDocuments?: DownloadedDocument[];

  /** File path where ZIP archive was saved */
  receiptFilePath?: string;
}

/** Failed registration result */
export interface TrademarkRegistrationFailure {
  success: false;

  /** Error code */
  errorCode: string;

  /** Human-readable error message */
  errorMessage: string;

  /** Detailed validation errors (if any) */
  validationErrors?: Array<{
    field: string;
    message: string;
  }>;

  /** Step where the error occurred */
  failedAtStep?: number;
}

/** Union type for registration result */
export type TrademarkRegistrationResult =
  | TrademarkRegistrationSuccess
  | TrademarkRegistrationFailure;

// ============================================================================
// INTERNAL TYPES (Session Management)
// ============================================================================

/** JSF session tokens extracted from HTML */
export interface JsfTokens {
  viewState: string;
  clientWindow: string;
  primefacesNonce: string;
}

/** Session state */
export interface DpmaSession {
  /** JSF Window ID (jfwid) */
  jfwid: string;

  /** Current step counter */
  stepCounter: number;

  /** JSF tokens */
  tokens: JsfTokens;

  /** Encrypted transaction ID (after final submit) */
  encryptedTransactionId?: string;
}

/** DPMA Versand API response */
export interface VersandResponse {
  validationResult: {
    state: 'ok' | 'error';
    userMessage: string | null;
    validationMessageList: Array<{
      message: string;
      severity: string;
    }>;
  };
  drn: string;
  akz: string;
  transactionId: string;
  transactionType: string;
  status: 'VERSAND_SUCCESS' | 'VERSAND_ERROR';
  creationTime: string;
}

/** dpmaViewId values for navigation */
export const DPMA_VIEW_IDS = {
  STEP_1_TO_2: 'agents',           // Anmelder → Anwalt/Kanzlei
  STEP_2_TO_3: 'correspondence',   // Anwalt/Kanzlei → Zustelladresse (discovered via Chrome DevTools)
  STEP_3_TO_4: 'trademark',        // Zustelladresse → Marke (discovered via Chrome DevTools)
  STEP_4_TO_5: 'wdvz',             // Marke → WDVZ
  STEP_5_TO_6: 'priorities',       // WDVZ → Sonstiges
  STEP_6_TO_7: 'payment',          // Sonstiges → Zahlung
  STEP_7_TO_8: 'submit',           // Zahlung → Zusammenfassung
} as const;

/** Country codes with German names */
export const COUNTRY_CODES: Record<string, string> = {
  'DE': 'Deutschland',
  'AT': 'Österreich',
  'CH': 'Schweiz',
  'FR': 'Frankreich',
  'IT': 'Italien',
  'ES': 'Spanien',
  'NL': 'Niederlande',
  'BE': 'Belgien',
  'PL': 'Polen',
  'GB': 'Vereinigtes Königreich',
  'US': 'Vereinigte Staaten',
  // Add more as needed
};
