/**
 * Request validation for DPMA Trademark Registration API
 * Provides comprehensive validation with detailed error messages
 */

import {
  TrademarkRegistrationRequest,
  ApplicantType,
  TrademarkType,
  PaymentMethod,
  NaturalPersonApplicant,
  LegalEntityApplicant,
} from '../types/dpma';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate ISO country code (2 letters)
 */
function isValidCountryCode(code: string): boolean {
  return /^[A-Z]{2}$/.test(code);
}

/**
 * Validate German postal code
 */
function isValidGermanZip(zip: string): boolean {
  return /^\d{5}$/.test(zip);
}

/**
 * Validate IBAN format (basic check)
 */
function isValidIBAN(iban: string): boolean {
  const cleanIban = iban.replace(/\s/g, '').toUpperCase();
  return /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(cleanIban);
}

/**
 * Validate BIC format
 */
function isValidBIC(bic: string): boolean {
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic.toUpperCase());
}

/**
 * Validate Nice class number
 */
function isValidNiceClass(classNumber: number): boolean {
  return Number.isInteger(classNumber) && classNumber >= 1 && classNumber <= 45;
}

/**
 * Validate the complete trademark registration request
 */
export function validateTrademarkRequest(request: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  // Check if request is an object
  if (!request || typeof request !== 'object') {
    return {
      valid: false,
      errors: [{ field: 'request', message: 'Request body must be a valid JSON object' }],
    };
  }

  const req = request as Partial<TrademarkRegistrationRequest>;

  // ============================================================================
  // Validate Applicant
  // ============================================================================
  if (!req.applicant) {
    errors.push({ field: 'applicant', message: 'Applicant information is required' });
  } else {
    const { applicant } = req;

    if (!applicant.type || !Object.values(ApplicantType).includes(applicant.type)) {
      errors.push({
        field: 'applicant.type',
        message: `Applicant type must be one of: ${Object.values(ApplicantType).join(', ')}`,
      });
    }

    if (applicant.type === ApplicantType.NATURAL) {
      const natural = applicant as Partial<NaturalPersonApplicant>;

      if (!natural.firstName?.trim()) {
        errors.push({ field: 'applicant.firstName', message: 'First name is required for natural persons' });
      }
      if (!natural.lastName?.trim()) {
        errors.push({ field: 'applicant.lastName', message: 'Last name is required for natural persons' });
      }
    } else if (applicant.type === ApplicantType.LEGAL) {
      const legal = applicant as Partial<LegalEntityApplicant>;

      if (!legal.companyName?.trim()) {
        errors.push({ field: 'applicant.companyName', message: 'Company name is required for legal entities' });
      }
    }

    // Validate address (common for both types)
    if (!applicant.address) {
      errors.push({ field: 'applicant.address', message: 'Address is required' });
    } else {
      const { address } = applicant;

      if (!address.street?.trim()) {
        errors.push({ field: 'applicant.address.street', message: 'Street is required' });
      }
      if (!address.zip?.trim()) {
        errors.push({ field: 'applicant.address.zip', message: 'Postal code is required' });
      } else if (address.country === 'DE' && !isValidGermanZip(address.zip)) {
        errors.push({ field: 'applicant.address.zip', message: 'Invalid German postal code (must be 5 digits)' });
      }
      if (!address.city?.trim()) {
        errors.push({ field: 'applicant.address.city', message: 'City is required' });
      }
      if (!address.country?.trim()) {
        errors.push({ field: 'applicant.address.country', message: 'Country code is required' });
      } else if (!isValidCountryCode(address.country)) {
        errors.push({ field: 'applicant.address.country', message: 'Country must be a valid 2-letter ISO code (e.g., DE, AT, CH)' });
      }
    }
  }

  // ============================================================================
  // Validate Sanctions Declaration (only required for Natural Persons)
  // ============================================================================
  if (req.applicant?.type === ApplicantType.NATURAL) {
    if (!req.sanctions) {
      errors.push({ field: 'sanctions', message: 'Sanctions declaration is required for natural persons' });
    } else {
      if (typeof req.sanctions.hasRussianNationality !== 'boolean') {
        errors.push({ field: 'sanctions.hasRussianNationality', message: 'Russian nationality declaration must be a boolean' });
      }
      if (typeof req.sanctions.hasRussianResidence !== 'boolean') {
        errors.push({ field: 'sanctions.hasRussianResidence', message: 'Russian residence declaration must be a boolean' });
      }
    }
  }

  // ============================================================================
  // Validate Email
  // ============================================================================
  if (!req.email?.trim()) {
    errors.push({ field: 'email', message: 'Email address is required' });
  } else if (!isValidEmail(req.email)) {
    errors.push({ field: 'email', message: 'Invalid email address format' });
  }

  // ============================================================================
  // Validate Trademark
  // ============================================================================
  if (!req.trademark) {
    errors.push({ field: 'trademark', message: 'Trademark information is required' });
  } else {
    const { trademark } = req;

    if (!trademark.type || !Object.values(TrademarkType).includes(trademark.type)) {
      errors.push({
        field: 'trademark.type',
        message: `Trademark type must be one of: ${Object.values(TrademarkType).join(', ')}`,
      });
    }

    if (trademark.type === TrademarkType.WORD) {
      if (!('text' in trademark) || !trademark.text?.trim()) {
        errors.push({ field: 'trademark.text', message: 'Trademark text is required for word marks' });
      } else if (trademark.text.length > 500) {
        errors.push({ field: 'trademark.text', message: 'Trademark text must not exceed 500 characters' });
      }
    }

    if (trademark.type === TrademarkType.FIGURATIVE) {
      if (!('imageData' in trademark) || !trademark.imageData) {
        errors.push({ field: 'trademark.imageData', message: 'Image data is required for image marks' });
      }
    }

    if (trademark.type === TrademarkType.COMBINED) {
      // Combined marks only require image (text is embedded in image)
      if (!('imageData' in trademark) || !trademark.imageData) {
        errors.push({ field: 'trademark.imageData', message: 'Image data is required for combined marks' });
      }
    }
  }

  // ============================================================================
  // Validate Nice Classes
  // ============================================================================
  if (!req.niceClasses || !Array.isArray(req.niceClasses)) {
    errors.push({ field: 'niceClasses', message: 'Nice classes array is required' });
  } else if (req.niceClasses.length === 0) {
    errors.push({ field: 'niceClasses', message: 'At least one Nice class must be selected' });
  } else {
    req.niceClasses.forEach((nc, index) => {
      if (!nc.classNumber) {
        errors.push({ field: `niceClasses[${index}].classNumber`, message: 'Class number is required' });
      } else if (!isValidNiceClass(nc.classNumber)) {
        errors.push({ field: `niceClasses[${index}].classNumber`, message: 'Class number must be between 1 and 45' });
      }
    });

    // Check for duplicates
    const classNumbers = req.niceClasses.map(nc => nc.classNumber);
    const uniqueClasses = new Set(classNumbers);
    if (uniqueClasses.size !== classNumbers.length) {
      errors.push({ field: 'niceClasses', message: 'Duplicate Nice classes are not allowed' });
    }
  }

  // Validate lead class if provided
  if (req.leadClass !== undefined) {
    if (!isValidNiceClass(req.leadClass)) {
      errors.push({ field: 'leadClass', message: 'Lead class must be between 1 and 45' });
    } else if (req.niceClasses && !req.niceClasses.some(nc => nc.classNumber === req.leadClass)) {
      errors.push({ field: 'leadClass', message: 'Lead class must be one of the selected Nice classes' });
    }
  }

  // ============================================================================
  // Validate Payment
  // ============================================================================
  if (!req.paymentMethod) {
    errors.push({ field: 'paymentMethod', message: 'Payment method is required' });
  } else if (!Object.values(PaymentMethod).includes(req.paymentMethod)) {
    errors.push({
      field: 'paymentMethod',
      message: `Payment method must be one of: ${Object.values(PaymentMethod).join(', ')}`,
    });
  }

  // Validate SEPA details if SEPA payment selected
  if (req.paymentMethod === PaymentMethod.SEPA_DIRECT_DEBIT) {
    if (!req.sepaDetails) {
      errors.push({ field: 'sepaDetails', message: 'SEPA details are required for direct debit payment' });
    } else {
      if (!req.sepaDetails.mandateReferenceNumber?.trim()) {
        errors.push({ field: 'sepaDetails.mandateReferenceNumber', message: 'SEPA mandate reference number is required' });
      }

      if (!req.sepaDetails.mandateType) {
        errors.push({ field: 'sepaDetails.mandateType', message: 'SEPA mandate type is required' });
      }

      // If not copying from applicant, contact details are required
      if (!req.sepaDetails.copyFromApplicant && !req.sepaDetails.contact) {
        errors.push({ field: 'sepaDetails.contact', message: 'SEPA contact details are required if not copying from applicant' });
      }
    }
  }

  // ============================================================================
  // Validate Sender Name (Step 8)
  // ============================================================================
  if (!req.senderName?.trim()) {
    errors.push({ field: 'senderName', message: 'Sender name is required for final submission' });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Type guard to check if validation passed
 */
export function isValidRequest(
  request: unknown,
  validationResult: ValidationResult
): request is TrademarkRegistrationRequest {
  return validationResult.valid;
}
