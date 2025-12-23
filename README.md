# DPMA Trademark Registration API

Automated German trademark registration via the DPMA (Deutsches Patent- und Markenamt) online portal.

## Overview

This API automates the complete trademark registration process with the German Patent and Trademark Office (DPMA). It handles:

- Session management and JSF token handling (ViewState, ClientWindow, PrimeFaces nonce)
- Multi-step form submission (8 steps)
- Nice classification selection with specific term support
- Image/file upload for figurative and combined marks
- Payment method configuration
- Receipt document download (ZIP archive)

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (with debug logging)
npm run dev

# Or build and run production
npm run build
npm start
```

Server runs on `http://localhost:3000` by default.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DEBUG` | `true` in dev, `false` in prod | Enable debug logging and file output |
| `NODE_ENV` | `development` | Environment mode |

## API Reference

### Health Check

```http
GET /health
```

Returns server status.

**Response:**
```json
{
  "success": true,
  "requestId": "uuid",
  "timestamp": "2025-12-19T12:00:00.000Z",
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "uptime": 3600
  }
}
```

### API Documentation

```http
GET /api
```

Returns available endpoints.

**Response:**
```json
{
  "success": true,
  "requestId": "uuid",
  "timestamp": "2025-12-19T12:00:00.000Z",
  "data": {
    "name": "DPMA Trademark Registration API",
    "version": "1.0.0",
    "endpoints": {
      "POST /api/trademark/register": "Register a new trademark",
      "GET /api/taxonomy/search": "Search Nice classification terms",
      "GET /api/taxonomy/validate": "Validate Nice class terms",
      "GET /api/taxonomy/classes": "List all Nice classes",
      "GET /api/taxonomy/classes/:id": "Get Nice class details",
      "GET /api/taxonomy/stats": "Get taxonomy statistics",
      "GET /health": "Health check",
      "GET /api": "API documentation"
    }
  }
}
```

### Register Trademark

```http
POST /api/trademark/register
Content-Type: application/json
```

Submits a trademark registration to DPMA.

## Request Format

### Complete Example (Natural Person)

```bash
curl -X POST http://localhost:3000/api/trademark/register \
  -H "Content-Type: application/json" \
  -d '{
    "applicant": {
      "type": "natural",
      "salutation": "Herr",
      "firstName": "Max",
      "lastName": "Mustermann",
      "address": {
        "street": "Musterstraße 123",
        "zip": "80331",
        "city": "München",
        "country": "DE"
      }
    },
    "email": "max@example.com",
    "sanctions": {
      "hasRussianNationality": false,
      "hasRussianResidence": false
    },
    "trademark": {
      "type": "word",
      "text": "MyBrandName"
    },
    "niceClasses": [
      { "classNumber": 9 },
      { "classNumber": 42 }
    ],
    "paymentMethod": "UEBERWEISUNG",
    "senderName": "Max Mustermann"
  }'
```

### Complete Example (Legal Entity / Company)

**Note:** Legal entities do NOT require the `sanctions` declaration - it only applies to natural persons. You can omit the `sanctions` object entirely for legal entity applicants.

```bash
curl -X POST http://localhost:3000/api/trademark/register \
  -H "Content-Type: application/json" \
  -d '{
    "applicant": {
      "type": "legal",
      "companyName": "Muster GmbH",
      "legalForm": "GmbH",
      "address": {
        "street": "Industriestraße 45",
        "zip": "10115",
        "city": "Berlin",
        "country": "DE"
      }
    },
    "email": "legal@muster-gmbh.de",
    "trademark": {
      "type": "word",
      "text": "MusterBrand"
    },
    "niceClasses": [
      { "classNumber": 35 }
    ],
    "paymentMethod": "UEBERWEISUNG",
    "senderName": "Muster GmbH"
  }'
```

### Example with Nice Class Terms (Sub-Classes)

```bash
curl -X POST http://localhost:3000/api/trademark/register \
  -H "Content-Type: application/json" \
  -d '{
    "applicant": {
      "type": "legal",
      "companyName": "Tech Startup GmbH",
      "legalForm": "GmbH",
      "address": {
        "street": "Innovationsweg 1",
        "zip": "80331",
        "city": "München",
        "country": "DE"
      }
    },
    "email": "info@techstartup.de",
    "sanctions": {
      "hasRussianNationality": false,
      "hasRussianResidence": false
    },
    "trademark": {
      "type": "word",
      "text": "TechBrand2024"
    },
    "niceClasses": [
      {
        "classNumber": 9,
        "terms": ["Anwendungssoftware", "Spielsoftware", "Betriebssysteme"]
      },
      {
        "classNumber": 42,
        "terms": ["IT-Dienstleistungen", "Entwicklung, Programmierung und Implementierung von Software"]
      }
    ],
    "leadClass": 9,
    "paymentMethod": "UEBERWEISUNG",
    "senderName": "Tech Startup GmbH"
  }'
```

## Complete Request Schema (All Fields)

This section shows the complete request structure with ALL possible fields. Fields marked with `*` are required.

```json
{
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: APPLICANT (Anmelder) - REQUIRED
  // ═══════════════════════════════════════════════════════════════════════════
  "applicant": {
    // Option A: Natural Person
    "type": "natural",                    // * Required: "natural" or "legal"
    "salutation": "Herr",                 // Optional: "Herr", "Frau", or title like "Dr."
    "firstName": "Max",                   // * Required for natural person
    "lastName": "Mustermann",             // * Required for natural person
    "nameSuffix": "Jr.",                  // Optional: name suffix
    "address": {                          // * Required
      "street": "Musterstraße 123",       // * Required: street + house number
      "addressLine1": "Gebäude A",        // Optional: additional address line
      "addressLine2": "3. Stock",         // Optional: only for natural persons
      "zip": "80331",                     // * Required: 5 digits for Germany
      "city": "München",                  // * Required
      "country": "DE"                     // * Required: ISO 2-letter code
    }

    // Option B: Legal Entity
    // "type": "legal",
    // "companyName": "Muster GmbH",      // * Required for legal entity
    // "legalForm": "GmbH",               // Optional: GmbH, AG, UG, etc.
    // "address": { ... }                 // * Required (same as above, no addressLine2)
  },

  // Sanctions Declaration - Only required for Natural Persons
  "sanctions": {
    "hasRussianNationality": false,       // * Required for natural persons: must be false
    "hasRussianResidence": false          // * Required for natural persons: must be false
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: REPRESENTATIVE (Anwalt/Kanzlei) - NOT YET IMPLEMENTED
  // ═══════════════════════════════════════════════════════════════════════════
  "representatives": [                    // Optional: array of representatives
    {
      "type": "legal",                    // * "natural" or "legal"
      "companyName": "Rechtsanwälte Muster & Partner",
      "legalForm": "PartG mbB",
      // For natural person: firstName, lastName, salutation
      "address": {
        "street": "Kanzleistraße 10",
        "zip": "60311",
        "city": "Frankfurt am Main",
        "country": "DE"
      },
      "contact": {
        "email": "info@kanzlei-muster.de", // * Required
        "telephone": "+49 69 12345678",    // Optional
        "fax": "+49 69 12345679"           // Optional
      },
      "lawyerRegistrationId": "RAK-FFM-12345",  // Optional: bar registration
      "internalReference": "M-2024-001"         // Optional: internal file ref
    }
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: DELIVERY ADDRESS (Zustelladresse) - OPTIONAL
  // ═══════════════════════════════════════════════════════════════════════════
  "email": "max@example.com",             // * Required: correspondence email

  "deliveryAddress": {                    // Optional: if different from applicant
    "copyFromApplicant": false,           // If true, copies from applicant
    "type": "natural",                    // * "natural" or "legal"
    "salutation": "Frau",
    "firstName": "Anna",
    "lastName": "Beispiel",               // * Required
    // For legal: "companyName", "legalForm"
    "address": {
      "street": "Lieferweg 7",
      "addressLine1": "",
      "addressLine2": "",
      "zip": "50667",
      "city": "Köln",
      "country": "DE"
    },
    "contact": {
      "email": "anna@example.com",        // * Required
      "telephone": "+49 221 9876543",     // Recommended
      "fax": ""
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: TRADEMARK (Marke) - REQUIRED
  // ═══════════════════════════════════════════════════════════════════════════
  "trademark": {
    // Option A: Word Mark
    "type": "word",                       // * Required
    "text": "MyBrandName",                // * Required for word marks (max 500 chars)

    // Option B: Image Mark (Bildmarke)
    // "type": "figurative",
    // "imageData": "<Buffer>",           // * Required: binary image data
    // "imageMimeType": "image/jpeg",     // * Required
    // "imageFileName": "logo.jpg",       // * Required

    // Option C: Combined Mark (Wort-/Bildmarke)
    // "type": "combined",
    // "imageData": "<Buffer>",           // * Required: image with embedded text
    // "imageMimeType": "image/jpeg",
    // "imageFileName": "combined-logo.jpg",

    // Option D: 3D Mark
    // "type": "3d",
    // "imageData": "<Buffer>",           // * Required
    // "imageMimeType": "image/jpeg",
    // "imageFileName": "3d-mark.jpg",

    // Option E: Sound Mark (NOT IMPLEMENTED)
    // "type": "sound",
    // "soundData": "<Buffer>",           // * Required: audio data
    // "soundMimeType": "audio/mpeg",     // * Required
    // "soundFileName": "sound-mark.mp3", // * Required

    // Common optional fields for all types:
    "colorElements": ["rot", "blau", "weiß"],  // Optional: German color names
    "hasNonLatinCharacters": false,            // Optional: non-Latin chars flag
    "description": "Beschreibung der Marke"    // Optional: trademark description
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: NICE CLASSIFICATION (Waren/Dienstleistungen) - REQUIRED
  // ═══════════════════════════════════════════════════════════════════════════
  "niceClasses": [                        // * Required: at least one class
    {
      "classNumber": 9,                   // * Required: 1-45
      "selectClassHeader": true           // Optional: select all terms in class
      // OR specify individual terms:
      // "terms": ["Anwendungssoftware", "Spielsoftware", "Betriebssysteme"]
    },
    {
      "classNumber": 35,
      "terms": ["Werbung, Marketing und Verkaufsförderung"]
    },
    {
      "classNumber": 42,
      "terms": [
        "IT-Dienstleistungen",
        "Entwicklung, Programmierung und Implementierung von Software",
        "Hosting-Dienste, Software as a Service [SaaS] und Vermietung von Software"
      ]
    }
  ],

  "leadClass": 9,                         // Optional: lead class (defaults to first)

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6: ADDITIONAL OPTIONS (Sonstiges) - OPTIONAL
  // ═══════════════════════════════════════════════════════════════════════════
  "options": {
    "acceleratedExamination": false,      // Optional: +200 EUR
    "certificationMark": false,           // Optional: §§ 106a ff. MarkenG
    "licensingDeclaration": false,        // Optional: § 42c MarkenV
    "saleDeclaration": false,             // Optional: § 42c MarkenV

    "priorityClaims": [                   // Optional: priority claims
      // Foreign Priority (§34 MarkenG)
      {
        "type": "foreign",
        "date": "2025-10-15",             // ISO date, max 6 months ago
        "country": "US",                  // ISO country code
        "applicationNumber": "97/123456"  // Foreign file number
      },
      // Exhibition Priority (§35 MarkenG)
      {
        "type": "exhibition",
        "date": "2025-11-01",             // ISO date, max 6 months ago
        "exhibitionName": "CeBIT 2025"    // Exhibition name
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 7: PAYMENT (Zahlung) - REQUIRED
  // ═══════════════════════════════════════════════════════════════════════════
  "paymentMethod": "UEBERWEISUNG",        // * Required: "UEBERWEISUNG" or "SEPASDD"

  // SEPA Details - Required if paymentMethod is "SEPASDD" (NOT YET IMPLEMENTED)
  "sepaDetails": {
    "mandateReferenceNumber": "A9530-XXX", // * Required for SEPA
    "mandateType": "permanent",            // * Required: "permanent" or "single"
    "copyFromApplicant": true,             // If true, uses applicant as contact
    // OR specify contact manually:
    "contact": {
      "type": "natural",                   // "natural" or "legal"
      "salutation": "Herr",
      "firstName": "Max",
      "lastName": "Mustermann",            // * Required
      // For legal: "companyName", "legalForm"
      "address": {
        "street": "Musterstraße 123",
        "zip": "80331",
        "city": "München",
        "country": "DE"
      },
      "telephone": "+49 89 12345678",      // * Required for SEPA
      "fax": "",
      "email": "max@example.com"           // * Required for SEPA
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 8: SUBMISSION (Zusammenfassung) - REQUIRED
  // ═══════════════════════════════════════════════════════════════════════════
  "senderName": "Max Mustermann",         // * Required: full name of sender

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERNAL/OPTIONAL
  // ═══════════════════════════════════════════════════════════════════════════
  "internalReference": "INT-2025-001"     // Optional: your internal reference
}
```

### Supported Country Codes

| Code | Country |
|------|---------|
| `DE` | Deutschland |
| `AT` | Österreich |
| `CH` | Schweiz |
| `FR` | Frankreich |
| `IT` | Italien |
| `ES` | Spanien |
| `NL` | Niederlande |
| `BE` | Belgien |
| `PL` | Polen |
| `GB` | Vereinigtes Königreich |
| `US` | Vereinigte Staaten |

Additional ISO 3166-1 alpha-2 codes are supported.

---

## Request Schema Details

### JSON Structure to Form Steps Mapping

The JSON request maps to the 8 DPMA form steps as follows:

| Step | DPMA Form | JSON Fields |
|------|-----------|-------------|
| 1 | Anmelder (Applicant) | `applicant`, `sanctions` |
| 2 | Anwalt/Kanzlei (Lawyer) | **ALWAYS SKIPPED** - representative support not yet implemented |
| 3 | Zustelladresse (Delivery) | `email`, `deliveryAddress` (optional) |
| 4 | Marke (Trademark) | `trademark` |
| 5 | Waren/Dienstleistungen | `niceClasses`, `leadClass` |
| 6 | Sonstiges (Options) | `options` |
| 7 | Zahlung (Payment) | `paymentMethod`, `sepaDetails` |
| 8 | Zusammenfassung (Submit) | `senderName` |

### Root Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `applicant` | object | Yes | Applicant information (see below) |
| `sanctions` | object | Conditional | Russia sanctions declaration - **Required only for Natural Persons** |
| `email` | string | Yes | Contact email for correspondence |
| `trademark` | object | Yes | Trademark details (see below) |
| `niceClasses` | array | Yes | At least one Nice class (see below) |
| `leadClass` | number | No | Lead class number (defaults to first class) |
| `paymentMethod` | string | Yes | `"UEBERWEISUNG"` (bank transfer) or `"SEPASDD"` (SEPA) |
| `sepaDetails` | object | Conditional | Required if paymentMethod is `"SEPASDD"` |
| `senderName` | string | Yes | Name of sender for final submission |
| `representatives` | array | No | **NOT YET IMPLEMENTED** - Step 2 is always skipped |
| `deliveryAddress` | object | No | Alternative delivery address |
| `options` | object | No | Additional options (see below) |
| `internalReference` | string | No | Your internal reference number |

### Applicant Object

#### Natural Person (`type: "natural"`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `"natural"` |
| `salutation` | string | No | `"Herr"`, `"Frau"`, or title (e.g., `"Dr."`) |
| `firstName` | string | Yes | First name |
| `lastName` | string | Yes | Last name |
| `nameSuffix` | string | No | Name suffix (optional) |
| `address` | object | Yes | Address object (see below) |

#### Legal Entity (`type: "legal"`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `"legal"` |
| `companyName` | string | Yes | Company name |
| `legalForm` | string | No | Legal form (GmbH, AG, UG, etc.) |
| `address` | object | Yes | Address object (see below) |

**Supported Legal Forms:**
- `GmbH` - Gesellschaft mit beschränkter Haftung
- `AG` - Aktiengesellschaft
- `UG` - Unternehmergesellschaft, haftungsbeschränkt
- `KG` - Kommanditgesellschaft
- `OHG` / `oHG` - Offene Handelsgesellschaft
- `GbR` - Gesellschaft bürgerlichen Rechts
- `eGbR` - eingetragene Gesellschaft bürgerlichen Rechts
- `eG` - eingetragene Genossenschaft
- `eV` / `e.V.` - eingetragener Verein
- `SE` - europäische Gesellschaft
- `KGaA` - Kommanditgesellschaft auf Aktien
- `PartG` - Partnerschaftsgesellschaft
- `PartGmbB` - Partnerschaftsgesellschaft mit beschränkter Berufshaftung
- `Stiftung` - Stiftung bürgerlichen Rechts

### Address Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `street` | string | Yes | Street name with house number (e.g., "Musterstraße 123") |
| `addressLine1` | string | No | Additional address line (labeled "Adresszusatz") |
| `addressLine2` | string | No | Additional address line 2 - **Only available for Natural Person** |
| `zip` | string | Yes | Postal code (5 digits for Germany) |
| `city` | string | Yes | City name |
| `country` | string | Yes | ISO 3166-1 alpha-2 code (e.g., `"DE"`, `"AT"`, `"CH"`) |

**Validation Rules:**
- `country` must be exactly 2 uppercase letters
- German (`DE`) postal codes must be exactly 5 digits
- Other countries have no postal code format validation

### Sanctions Declaration Object (Natural Person ONLY)

**IMPORTANT:** This section only applies to Natural Person applicants (`type: "natural"`). Legal Entity applicants do NOT need to provide sanctions information - you can omit the `sanctions` object entirely for legal entities.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `hasRussianNationality` | boolean | Yes | Must be `false` to proceed |
| `hasRussianResidence` | boolean | Yes | Must be `false` to proceed |

### Contact Info Object

Used by `deliveryAddress`, `representatives`, and `sepaDetails.contact`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Email address |
| `telephone` | string | Conditional | Phone number (required for delivery address and SEPA) |
| `fax` | string | No | Fax number |

### Delivery Address Object (Optional)

Use this if you want official correspondence sent to a different address than the applicant's address.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `copyFromApplicant` | boolean | No | If true, copies address from applicant |
| `type` | string | Yes | `"natural"` or `"legal"` |
| `lastName` | string | Yes | Last name (required even for legal entities) |
| `firstName` | string | No | First name (for natural persons) |
| `salutation` | string | No | Title/salutation |
| `companyName` | string | No | Company name (for legal entities) |
| `legalForm` | string | No | Legal form (for legal entities) |
| `address` | object | Yes | Address object |
| `contact` | object | Yes | Contact info object (see above)

### Representative Object (NOT YET IMPLEMENTED)

Representatives/lawyers can be added but Step 2 is currently always skipped.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | `"natural"` or `"legal"` |
| `salutation` | string | No | Title/salutation (for natural person) |
| `firstName` | string | Conditional | First name (required for natural person) |
| `lastName` | string | Conditional | Last name (required for natural person) |
| `companyName` | string | Conditional | Company name (required for legal entity) |
| `legalForm` | string | No | Legal form (for legal entity) |
| `address` | object | Yes | Address object |
| `contact` | object | Yes | Contact info object |
| `lawyerRegistrationId` | string | No | Bar association registration ID (Rechtsanwaltskammer-ID) |
| `internalReference` | string | No | Internal file reference (Geschäftszeichen) |

### Trademark Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Trademark type (see below) |
| `text` | string | Conditional | Required for `"word"` type (max 500 characters) |
| `imageData` | Buffer | Conditional | Required for `"figurative"`, `"combined"`, `"3d"` |
| `imageMimeType` | string | Conditional | MIME type (e.g., `"image/jpeg"`, `"image/png"`) |
| `imageFileName` | string | Conditional | Original filename |
| `colorElements` | string[] | No | Color elements in the trademark (German color names) |
| `hasNonLatinCharacters` | boolean | No | Contains non-Latin characters |
| `description` | string | No | Trademark description |

**Supported Trademark Types:**

| Type | API Value | DPMA Form | Status | Description |
|------|-----------|-----------|--------|-------------|
| Word Mark | `"word"` | Wortmarke | Implemented | Text-only trademark |
| Image Mark | `"figurative"` | Bildmarke | Implemented | Pure image trademark (no text) |
| Combined Mark | `"combined"` | Wort-/Bildmarke | Implemented | Word/image combination (text embedded in image) |
| 3D Mark | `"3d"` | Dreidimensionale Marke | Implemented | Three-dimensional trademark |
| Color Mark | `"color"` | Farbmarke | Not implemented | Color trademark |
| Sound Mark | `"sound"` | Klangmarke | Not implemented | Audio trademark |
| Position Mark | `"position"` | Positionsmarke | Not implemented | Position-based trademark |
| Pattern Mark | `"pattern"` | Mustermarke | Not implemented | Pattern/texture trademark |
| Motion Mark | `"motion"` | Bewegungsmarke | Not implemented | Animated trademark |
| Multimedia Mark | `"multimedia"` | Multimediamarke | Not implemented | Combined audio/video |
| Hologram Mark | `"hologram"` | Hologrammmarke | Not implemented | Holographic trademark |
| Thread Mark | `"thread"` | Kennfadenmarke | Not implemented | Thread marker (textiles) |
| Other Mark | `"other"` | Sonstige Marke | Not implemented | Other special types |

**Type-Specific Fields:**

| Trademark Type | Required Fields |
|----------------|-----------------|
| `"word"` | `text` (max 500 chars) |
| `"figurative"` | `imageData`, `imageMimeType`, `imageFileName` |
| `"combined"` | `imageData`, `imageMimeType`, `imageFileName` |
| `"3d"` | `imageData`, `imageMimeType`, `imageFileName` |
| `"color"` | `imageData` (optional) |
| `"sound"` | `soundData`, `soundMimeType`, `soundFileName` |
| `"thread"` | `imageData`, `imageMimeType`, `imageFileName` |
| Others | `imageData` (optional) |

**Sound Trademark Fields (Not Yet Implemented):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `soundData` | Buffer | Yes | Audio file data |
| `soundMimeType` | string | Yes | MIME type (e.g., `"audio/mpeg"`) |
| `soundFileName` | string | Yes | Original filename |

**Image Requirements:**
- Format: JPG preferred (PNG may have color conversion issues)
- Minimum: 945 pixels on at least one side
- Maximum: 2835 x 2010 pixels

**Trademark Description Limits:**
- Maximum: 2000 characters OR 150 words (whichever is reached first)

**Notes:**
- For `"figurative"`, `"combined"`, and `"3d"` marks, `imageData` is required
- For `"combined"` marks, the text is embedded within the image itself (no separate text field)

### Nice Classes Array

Each element in the array:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `classNumber` | number | Yes | Class number (1-45) |
| `terms` | string[] | No | Specific German terms within the class |
| `selectClassHeader` | boolean | No | If true, selects the entire class header |

#### Term Selection Modes

1. **Select entire class header** (all terms in a category):
   ```json
   { "classNumber": 9, "selectClassHeader": true }
   ```

2. **Select specific individual terms** (using exact DPMA German names):
   ```json
   {
     "classNumber": 9,
     "terms": ["Anwendungssoftware", "Spielsoftware", "Betriebssysteme"]
   }
   ```

3. **Default behavior** (no terms specified): Selects the class header.

#### Common DPMA Term Names

**Class 9 (Software/Electronics):**
- `Anwendungssoftware` - Application software
- `Spielsoftware` - Game software
- `Betriebssysteme` - Operating systems
- `Künstliche Intelligenz-Software und maschinelle Lernsoftware` - AI/ML software

**Class 35 (Business):**
- `Werbung, Marketing und Verkaufsförderung` - Advertising, marketing

**Class 42 (IT Services):**
- `IT-Dienstleistungen` - IT services
- `Entwicklung, Programmierung und Implementierung von Software` - Software development
- `Hosting-Dienste, Software as a Service [SaaS] und Vermietung von Software` - Hosting/SaaS

### Options Object (Optional)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `acceleratedExamination` | boolean | false | Request accelerated examination (+200 EUR) |
| `certificationMark` | boolean | false | Register as certification mark (§§ 106a ff. MarkenG) |
| `licensingDeclaration` | boolean | false | Licensing willingness declaration (§ 42c MarkenV) |
| `saleDeclaration` | boolean | false | Sale willingness declaration (§ 42c MarkenV) |
| `priorityClaims` | array | [] | Priority claims (see below) |

### Priority Claims (Optional)

Priority claims allow you to claim an earlier filing date from a foreign application or exhibition. Both types have a **6-month time limit**.

#### Foreign Priority (Ausländische Priorität - §34 MarkenG)

If the trademark was already filed abroad (Paris Convention countries), you can claim that earlier filing date.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `"foreign"` |
| `date` | string | Yes | ISO date (YYYY-MM-DD), must be within last 6 months |
| `country` | string | Yes | ISO country code (e.g., `"US"`, `"GB"`, `"EM"` for EU) |
| `applicationNumber` | string | Yes | Foreign application/file number |

**Example:**
```json
{
  "options": {
    "priorityClaims": [
      {
        "type": "foreign",
        "date": "2025-10-15",
        "country": "US",
        "applicationNumber": "97/123456"
      }
    ]
  }
}
```

#### Exhibition Priority (Ausstellungspriorität - §35 MarkenG)

If goods/services were shown at an officially recognized exhibition within the last 6 months.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `"exhibition"` |
| `date` | string | Yes | ISO date (YYYY-MM-DD), must be within last 6 months |
| `exhibitionName` | string | Yes | Name of the exhibition |

**Example:**
```json
{
  "options": {
    "priorityClaims": [
      {
        "type": "exhibition",
        "date": "2025-11-01",
        "exhibitionName": "CeBIT 2025"
      }
    ]
  }
}
```

#### Priority Date Validation

The API validates priority dates before submission:
- **No future dates**: Date must be in the past
- **Max 6 months old**: Date cannot be older than 6 months from today

**Note:** Priority proofs must be submitted to DPMA in writing after the application is filed.

### SEPA Details Object (Required for SEPA payment)

> **NOT YET IMPLEMENTED**: SEPA direct debit payment is defined in the API schema but not yet functional. Use `"UEBERWEISUNG"` (bank transfer) for now.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mandateReferenceNumber` | string | Yes | SEPA mandate reference number |
| `mandateType` | string | Yes | `"permanent"` or `"single"` |
| `copyFromApplicant` | boolean | No | Copy contact from applicant |
| `contact` | object | Conditional | SEPA contact (required if not copying) |

#### SEPA Contact Object (Natural Person)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `"natural"` |
| `salutation` | string | No | Title/salutation |
| `lastName` | string | Yes | Last name |
| `firstName` | string | No | First name |
| `address` | object | Yes | Address object |
| `telephone` | string | Yes | Phone number (required for SEPA) |
| `fax` | string | No | Fax number |
| `email` | string | Yes | Email address |

#### SEPA Contact Object (Legal Entity)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `"legal"` |
| `companyName` | string | Yes | Company name |
| `legalForm` | string | No | Legal form |
| `address` | object | Yes | Address object |
| `telephone` | string | Yes | Phone number (required for SEPA) |
| `fax` | string | No | Fax number |
| `email` | string | Yes | Email address |

## Response Format

### Success Response (HTTP 201)

```json
{
  "success": true,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-12-19T12:41:05.000Z",
  "data": {
    "aktenzeichen": "302025261416.4",
    "drn": "2025121812410513WA",
    "transactionId": "20251218124058138",
    "submissionTime": "2025-12-18T12:41:05.250297138",
    "fees": [
      {
        "code": "331000",
        "description": "Anmeldeverfahren - bei elektronischer Anmeldung",
        "amount": 290
      }
    ],
    "payment": {
      "method": "UEBERWEISUNG",
      "totalAmount": 290,
      "currency": "EUR",
      "bankDetails": {
        "recipient": "Bundeskasse",
        "iban": "DE84 7000 0000 0070 0010 54",
        "bic": "MARKDEF1700",
        "reference": "302025261416.4"
      }
    },
    "documents": [
      {
        "filename": "W7005-01.PDF",
        "mimeType": "application/pdf",
        "dataBase64": "JVBERi0xLjQK..."
      }
    ],
    "receiptFilePath": "/path/to/receipts/302025261416_4_documents.zip"
  }
}
```

#### Response Fields

| Field | Description |
|-------|-------------|
| `aktenzeichen` | Official DPMA file reference number |
| `drn` | Document reference number |
| `transactionId` | DPMA transaction identifier |
| `submissionTime` | ISO 8601 timestamp of submission |
| `fees` | Array of applicable fees |
| `payment.bankDetails` | Bank transfer details (use `aktenzeichen` as reference!) |
| `documents` | Array of Base64-encoded documents from ZIP |
| `receiptFilePath` | Local file path where ZIP archive was saved |

### Error Response (HTTP 400/500)

```json
{
  "success": false,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-12-19T12:00:00.000Z",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "email", "message": "Invalid email format" },
      { "field": "applicant.address.zip", "message": "Invalid German postal code" }
    ]
  }
}
```

#### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed (check `details` array) |
| `INVALID_QUERY` | 400 | Search query too short (minimum 2 characters) |
| `INVALID_REQUEST` | 400 | Missing required parameters |
| `INVALID_CLASS` | 400 | Nice class number outside 1-45 range |
| `TAXONOMY_ERROR` | 500 | Taxonomy service error |
| `INTERNAL_ERROR` | 500 | Unexpected error occurred |
| `NOT_FOUND` | 404 | Unknown endpoint |

## Fees

| Description | Amount |
|-------------|--------|
| Base fee (1-3 classes, electronic filing) | 290 EUR |
| Each additional class (4+) | 100 EUR |
| Accelerated examination (optional) | 200 EUR |

## Nice Classification Reference

The Nice Classification divides goods and services into 45 classes:

### Goods (Classes 1-34)

| Class | Description |
|-------|-------------|
| 9 | Electronics, software, apps, computers |
| 25 | Clothing, footwear, headgear |
| 28 | Games, toys, sporting goods |
| 30 | Coffee, tea, pastry, confectionery |

### Services (Classes 35-45)

| Class | Description |
|-------|-------------|
| 35 | Advertising, business management, retail |
| 41 | Education, entertainment, sports |
| 42 | IT services, software development, SaaS |
| 43 | Restaurant, hotel, catering services |

## Taxonomy API Endpoints

The API provides REST endpoints for searching and validating Nice classification terms. These endpoints use Damerau-Levenshtein distance for fuzzy matching, which handles typos, missing characters, transpositions, and German umlauts.

### Search Terms

```http
GET /api/taxonomy/search?q=software&class=9&limit=10
```

Search for Nice classification terms with fuzzy matching.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | required | Search query (min 2 chars) |
| `class` | number | all | Filter by Nice class (1-45) |
| `limit` | number | 20 | Max results (max 100) |
| `minScore` | number | 0.3 | Minimum similarity score (0-1) |
| `leafOnly` | boolean | false | Only return leaf terms |

**Example Response:**
```json
{
  "success": true,
  "requestId": "uuid",
  "timestamp": "2025-12-23T12:00:00.000Z",
  "data": {
    "query": "software",
    "count": 5,
    "results": [
      {
        "text": "Software",
        "classNumber": 9,
        "conceptId": "1528632",
        "level": 3,
        "path": ["Klasse 9", "Herunterladbare Software", "Software"],
        "childCount": 68,
        "isLeaf": false
      }
    ]
  }
}
```

### Validate Terms

```http
GET /api/taxonomy/validate?terms=Software,Anwendungssoftware&class=9
```

Or via POST:
```http
POST /api/taxonomy/validate
Content-Type: application/json
{ "terms": ["Software", "InvalidTerm"], "classNumber": 9 }
```

Validate one or more terms against the taxonomy. Returns suggestions for invalid terms.

**Example Response:**
```json
{
  "success": true,
  "data": {
    "valid": false,
    "classNumber": 9,
    "results": [
      { "term": "Software", "valid": true, "entry": {...} },
      {
        "term": "InvalidTerm",
        "valid": false,
        "suggestions": [...],
        "error": "Term \"InvalidTerm\" not found. Did you mean..."
      }
    ]
  }
}
```

### List All Classes

```http
GET /api/taxonomy/classes
```

Returns summary of all 45 Nice classes.

**Example Response:**
```json
{
  "success": true,
  "data": {
    "classes": [
      { "classNumber": 1, "name": "Klasse 1", "category": "goods", "categoryCount": 12, "totalItems": 4633 },
      { "classNumber": 9, "name": "Klasse 9", "category": "goods", "categoryCount": 10, "totalItems": 5929 },
      { "classNumber": 42, "name": "Klasse 42", "category": "services", "categoryCount": 6, "totalItems": 1892 }
    ]
  }
}
```

### Get Class Details

```http
GET /api/taxonomy/classes/9
```

Returns detailed information about a specific Nice class.

**Example Response:**
```json
{
  "success": true,
  "data": {
    "classNumber": 9,
    "name": "Klasse 9",
    "category": "goods",
    "totalItems": 5929,
    "categories": [
      { "text": "Software", "level": 2, "childCount": 68, ... },
      { "text": "IT-Dienstleistungen", "level": 2, "childCount": 45, ... }
    ],
    "allEntries": [...]
  }
}
```

### Taxonomy Statistics

```http
GET /api/taxonomy/stats
```

Returns statistics about the loaded taxonomy.

**Example Response:**
```json
{
  "success": true,
  "data": {
    "totalEntries": 777,
    "leafCount": 581,
    "categoryCount": 196,
    "loaded": true,
    "classCounts": { "1": 12, "2": 8, "9": 81, ... }
  }
}
```

---

## Nice Classification Taxonomy Service

The API includes a **TaxonomyService** that provides pre-validation of Nice class terms against the official DPMA classification hierarchy. This helps catch invalid terms before submission and provides suggestions for corrections.

### Fuzzy Matching Algorithm

The TaxonomyService uses **Damerau-Levenshtein distance** for fuzzy string matching with these optimizations:

1. **Single-row space optimization**: O(min(m,n)) space instead of O(m*n)
2. **Early termination**: Stops when distance exceeds threshold
3. **Length-based pruning**: Skips comparison if length difference exceeds threshold
4. **Transposition support**: "ab" -> "ba" counts as 1 edit, not 2
5. **Unicode-aware**: Handles German umlauts (ä->ae, ö->oe, ü->ue, ß->ss)

**Supported corrections:**

| Input | Matches | Reason |
|-------|---------|--------|
| `Softawre` | Software | Typo correction |
| `Softwar` | Software | Missing character |
| `Softwrae` | Software | Transposition |
| `Buero` | Büro | Umlaut normalization |
| `anwendungs software` | Anwendungssoftware | Whitespace handling |

### Taxonomy Structure

The Nice classification is organized hierarchically:

```
Level 1: Klasse 1-45 (Top-level classes)
  Level 2: Main categories (e.g., "Software", "IT-Dienstleistungen")
    Level 3: Subcategories (e.g., "Anwendungssoftware", "Spielsoftware")
      Level 4+: Deeper subcategories
        Leaf nodes: Individual selectable terms
```

The taxonomy database contains **777 category entries** covering all 45 Nice classes. The DPMA form dynamically loads individual terms (~70,000 total) when categories are expanded.

### Using TaxonomyService

```typescript
import { TaxonomyService, getTaxonomyService } from './client/services';

// Option 1: Get singleton instance (recommended)
const taxonomy = await getTaxonomyService();

// Option 2: Create your own instance
const taxonomy = new TaxonomyService();
await taxonomy.load();

// Check if a term exists
const result = taxonomy.validateTerm('Software', 9);
if (result.found) {
  console.log('Valid term:', result.entry.text);
} else {
  console.log('Invalid. Suggestions:', result.suggestions);
}

// Search for terms
const matches = taxonomy.search('künstliche intelligenz', {
  classNumbers: [9],
  limit: 10
});

// Get all categories for a class
const class9Categories = taxonomy.getClassCategories(9);
```

### Available Methods

| Method | Description |
|--------|-------------|
| `load(path?)` | Load taxonomy from JSON file (default: `docs/taxonomyDe.json`) |
| `isLoaded()` | Check if taxonomy is loaded |
| `getEntryCount()` | Get total number of indexed entries |
| `getAvailableClasses()` | Get array of class numbers (1-45) |
| `findExact(text, classNumber?)` | Find entry by exact text match |
| `findByConceptId(conceptId)` | Find entry by DPMA concept ID |
| `search(query, options)` | Fuzzy search with scoring |
| `validateTerm(term, classNumber?)` | Validate a term with suggestions |
| `validateNiceClasses(selections)` | Validate entire NiceClassSelection array |
| `getClassHeader(classNumber)` | Get the class header entry |
| `getClassCategories(classNumber)` | Get main categories (level 2) for a class |
| `getClassEntries(classNumber)` | Get all entries for a specific Nice class |
| `getStats()` | Get taxonomy statistics |

### Search Options

```typescript
interface TaxonomySearchOptions {
  classNumbers?: number[];  // Limit to specific classes
  leafOnly?: boolean;       // Only return leaf nodes
  limit?: number;           // Max results (default: 20)
  minScore?: number;        // Minimum match score 0-1 (default: 0.3)
}
```

### Pre-Validation in Step 5

The `Step5NiceClasses` step supports optional pre-validation:

```typescript
// Automatic validation during execution
step5.setTaxonomyService(await getTaxonomyService());
await step5.execute(request);  // Logs validation warnings

// Or explicit pre-validation
const validation = await step5.preValidate(request.niceClasses);
if (!validation.valid) {
  console.log('Errors:', validation.errors);
  console.log('Warnings:', validation.warnings);
}
```

### Taxonomy Data Source

The taxonomy data (`docs/taxonomyDe.json`) is derived from the official DPMA Nice Classification database. It contains:

- **45 classes** (Klasse 1-45)
- **777 category entries** (hierarchical structure)
- **~70,000 leaf terms** (indicated by `ItemsSize` counts, loaded dynamically on DPMA form)

Each entry includes:

| Field | Description |
|-------|-------------|
| `Text` | German term name |
| `ClassNumber` | Nice class (1-45) |
| `ConceptId` | Unique DPMA identifier |
| `Level` | Hierarchy depth |
| `ItemsSize` | Total leaf terms under this node |

## File Structure

```
dpma/
├── src/
│   ├── index.ts                 # Application entry point
│   ├── comprehensive-test.ts    # Integration test suite (12 scenarios)
│   ├── test.ts                  # API endpoint testing script
│   ├── test-combined-mark.ts    # Word mark submission test
│   ├── api/
│   │   └── server.ts            # Express server & routes
│   ├── client/
│   │   ├── DPMAClient.ts        # Main DPMA client orchestrator
│   │   ├── index.ts             # Client module exports
│   │   ├── http/
│   │   │   ├── HttpClient.ts    # HTTP client with cookie jar support
│   │   │   ├── AjaxHelpers.ts   # AJAX request builders & form encoding
│   │   │   └── index.ts         # HTTP module exports
│   │   ├── session/
│   │   │   ├── SessionManager.ts    # JSF session state management
│   │   │   ├── TokenExtractor.ts    # ViewState/ClientWindow/Nonce extraction
│   │   │   └── index.ts             # Session module exports
│   │   ├── services/
│   │   │   ├── TaxonomyService.ts   # Nice classification validation & search
│   │   │   ├── VersandService.ts    # Final submission dispatch
│   │   │   ├── DocumentService.ts   # Receipt document handling & ZIP extraction
│   │   │   └── index.ts             # Services module exports
│   │   ├── steps/
│   │   │   ├── BaseStep.ts          # Base class for form steps
│   │   │   ├── Step1Applicant.ts    # Applicant information
│   │   │   ├── Step2Lawyer.ts       # Lawyer (always skipped)
│   │   │   ├── Step3DeliveryAddress.ts  # Delivery address
│   │   │   ├── Step4Trademark.ts    # Trademark details & image upload
│   │   │   ├── Step5NiceClasses.ts  # Nice classification selection
│   │   │   ├── Step6Options.ts      # Additional options & priority claims
│   │   │   ├── Step7Payment.ts      # Payment method
│   │   │   ├── Step8Final.ts        # Summary & submit
│   │   │   └── index.ts             # Steps module exports
│   │   └── utils/
│   │       ├── DebugLogger.ts         # Debug logging utility
│   │       ├── CountryMapper.ts       # Country code to German name mapping
│   │       ├── LegalFormMapper.ts     # Legal form normalization
│   │       ├── LevenshteinDistance.ts # Fuzzy string matching algorithm
│   │       └── index.ts               # Utils module exports
│   ├── data/
│   │   └── nice-classes.ts      # Nice classification reference data
│   ├── types/
│   │   ├── dpma.ts              # TypeScript type definitions
│   │   ├── nice-classification.ts # Nice classification types
│   │   └── index.ts             # Types module exports
│   └── validation/
│       └── validateRequest.ts   # Request validation
├── tests/
│   ├── taxonomyService.test.ts  # TaxonomyService unit tests
│   ├── legalFormMapper.test.ts  # Legal form mapping tests
│   ├── levenshtein.test.ts      # String similarity algorithm tests
│   └── validation.test.ts       # Request validation tests
├── docs/
│   ├── DPMA_FORM_FIELDS.md      # Complete form field documentation
│   └── taxonomyDe.json          # Nice classification hierarchy (German)
├── receipts/                     # Downloaded ZIP archives (auto-created)
├── debug/                        # Debug files when DEBUG=true (auto-created)
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## Important Notes

1. **Real Submissions**: This API submits REAL trademark applications to DPMA. Each submission incurs real fees (minimum 290 EUR).

2. **Payment Deadline**: After submission, payment must be made within **3 months** using the provided bank details and the `aktenzeichen` as payment reference. Failure to pay results in automatic withdrawal of the application.

3. **Receipt Storage**: Receipt ZIP archives are automatically saved to the `receipts/` folder with the format `{aktenzeichen}_documents.zip`.

4. **Debug Mode**: When `DEBUG=true`, detailed logs are output and response XMLs are saved to the `debug/` folder for troubleshooting.

5. **Nice Class Terms**: Terms must use the exact German names as shown in the DPMA form. The TaxonomyService provides fuzzy matching to help find correct terms.

6. **Implemented Features**:
   - Word marks (`"word"`) - Fully supported
   - Image marks (`"figurative"`) - Fully supported with image upload
   - Combined marks (`"combined"`) - Fully supported with image upload
   - 3D marks (`"3d"`) - Fully supported with image upload
   - Other trademark types - Not yet implemented
   - Bank transfer (`"UEBERWEISUNG"`) - Fully supported
   - SEPA direct debit (`"SEPASDD"`) - Not yet implemented
   - Representatives/Lawyers - Not yet implemented (Step 2 always skipped)

7. **Delivery Address**: By default, the applicant's address is used. Set `deliveryAddress` with a different address if needed.

## Testing

The project includes Jest unit tests and integration tests.

### Unit Tests (Jest)

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

**Test Coverage:**
- **Validation Tests**: Request structure, applicant types, email formats, Nice classes, payment methods, SEPA validation
- **Levenshtein Tests**: Distance calculation, similarity scoring, fuzzy matching, German umlaut normalization
- **Legal Form Tests**: All German legal form abbreviations (GmbH, AG, UG, etc.)
- **Taxonomy Tests**: Nice classification loading, search, validation, fuzzy term matching

### Integration Tests

```bash
# List all available integration test scenarios
npm run test:integration -- --list

# Run validation tests only (no DPMA connection)
npm run test:integration -- --validate-only

# Test invalid request detection
npm run test:integration -- --invalid

# Run dry-run test (connects to DPMA, stops before final submission)
npm run test:integration -- --dry-run --scenario 1

# Run all scenarios in dry-run mode
npm run test:integration -- --dry-run --all
```

### Integration Test Modes

| Mode | Description |
|------|-------------|
| `--validate-only` | Validates all test scenarios without connecting to DPMA |
| `--invalid` | Tests that invalid requests are properly rejected |
| `--dry-run` | Connects to DPMA and runs through steps 1-7, but stops before final submission |
| `--list` | Lists all available test scenarios |
| `--help` | Shows usage information |

### Test Scenarios

The integration test suite includes 12 scenarios covering:
- Natural persons and legal entities
- Word marks, image marks, and combined marks
- Nice class term selection (headers and specific terms)
- Accelerated examination option
- Separate delivery addresses
- Multiple Nice classes
- Austrian applicants (different postal code format)
- Full complex scenarios with all options

## Development

```bash
# Run in development mode with auto-reload
npm run dev

# Build TypeScript
npm run build

# Run production build
npm start

# Type checking
npx tsc --noEmit
```

## License

Private/Internal Use
