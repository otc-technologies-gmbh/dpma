# DPMA Trademark Registration API

Automated German trademark registration via the DPMA (Deutsches Patent- und Markenamt) online portal.

## Overview

This API automates the complete trademark registration process with the German Patent and Trademark Office (DPMA). It handles:

- Session management and CSRF token handling
- Multi-step form submission (8 steps)
- Nice classification selection with specific term support
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
    "sanctions": {
      "hasRussianNationality": false,
      "hasRussianResidence": false
    },
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

## Request Schema

### JSON Structure to Form Steps Mapping

The JSON request maps to the 8 DPMA form steps as follows:

| Step | DPMA Form | JSON Fields |
|------|-----------|-------------|
| 1 | Anmelder (Applicant) | `applicant`, `sanctions` |
| 2 | Anwalt/Kanzlei (Lawyer) | `representatives` (optional, skipped if empty) |
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
| `sanctions` | object | Yes | EU sanctions declaration (see below) |
| `email` | string | Yes | Contact email for correspondence |
| `trademark` | object | Yes | Trademark details (see below) |
| `niceClasses` | array | Yes | At least one Nice class (see below) |
| `leadClass` | number | No | Lead class number (defaults to first class) |
| `paymentMethod` | string | Yes | `"UEBERWEISUNG"` (bank transfer) or `"SEPASDD"` (SEPA) |
| `sepaDetails` | object | Conditional | Required if paymentMethod is `"SEPASDD"` |
| `senderName` | string | Yes | Name of sender for final submission |
| `representatives` | array | No | Legal representative(s) |
| `deliveryAddress` | object | No | Alternative delivery address |
| `options` | object | No | Additional options (see below) |
| `internalReference` | string | No | Your internal reference number |

### Applicant Object

#### Natural Person (`type: "natural"`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `"natural"` |
| `salutation` | string | No | `"Herr"`, `"Frau"`, or title |
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
- `eG` - eingetragene Genossenschaft
- `eV` / `e.V.` - eingetragener Verein
- `SE` - europäische Gesellschaft
- `KGaA` - Kommanditgesellschaft auf Aktien
- `PartG` - Partnerschaftsgesellschaft
- `PartGmbB` - Partnerschaftsgesellschaft mit beschränkter Berufshaftung

### Address Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `street` | string | Yes | Street name with house number (e.g., "Musterstraße 123") |
| `addressLine1` | string | No | Additional address line |
| `addressLine2` | string | No | Additional address line 2 |
| `zip` | string | Yes | Postal code (5 digits for Germany) |
| `city` | string | Yes | City name |
| `country` | string | Yes | ISO 3166-1 alpha-2 code (e.g., `"DE"`, `"AT"`, `"CH"`) |

### Sanctions Declaration Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `hasRussianNationality` | boolean | Yes | Must be `false` to proceed |
| `hasRussianResidence` | boolean | Yes | Must be `false` to proceed |

### Delivery Address Object (Optional)

Use this if you want official correspondence sent to a different address than the applicant's address.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `copyFromApplicant` | boolean | No | If true, copies address from applicant |
| `type` | string | Yes | `"natural"` or `"legal"` |
| `lastName` | string | Yes | Last name (or company name for legal) |
| `firstName` | string | No | First name (for natural persons) |
| `salutation` | string | No | Title/salutation |
| `companyName` | string | No | Company name (for legal entities) |
| `legalForm` | string | No | Legal form (for legal entities) |
| `address` | object | Yes | Address object |
| `contact` | object | Yes | Contact info with `email` (required) and optional `telephone`, `fax` |

### Trademark Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Trademark type (see below) |
| `text` | string | Conditional | Required for `"word"` type |
| `imageData` | Buffer | Conditional | Required for `"figurative"` and `"combined"` |
| `imageMimeType` | string | Conditional | MIME type (e.g., `"image/jpeg"`) |
| `imageFileName` | string | Conditional | Original filename |
| `colorElements` | string[] | No | Color elements in the trademark |
| `hasNonLatinCharacters` | boolean | No | Contains non-Latin characters |
| `description` | string | No | Trademark description |

**Supported Trademark Types:**
| Type | Value | Description |
|------|-------|-------------|
| Word Mark | `"word"` | Text-only trademark (Wortmarke) |
| Image Mark | `"figurative"` | Image-only trademark (Bildmarke) |
| Combined Mark | `"combined"` | Word/image combination (Wort-/Bildmarke) |

**Note:** For `"combined"` marks, only `imageData` is required. The text is embedded within the image itself.

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
| `certificationMark` | boolean | false | Register as certification mark |
| `licensingDeclaration` | boolean | false | Include licensing willingness declaration |
| `saleDeclaration` | boolean | false | Include sale willingness declaration |

### SEPA Details Object (Required for SEPA payment)

**Note:** Requires a valid SEPA mandate (A9530 form) to be on file with DPMA.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `mandateReferenceNumber` | string | Yes | SEPA mandate reference number |
| `mandateType` | string | Yes | `"permanent"` or `"single"` |
| `copyFromApplicant` | boolean | No | Copy contact from applicant |
| `contact` | object | Conditional | SEPA contact (required if not copying) |

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

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed (check `details` array) |
| `SESSION_ERROR` | Failed to establish session with DPMA |
| `SUBMISSION_ERROR` | Form submission failed |
| `INTERNAL_ERROR` | Unexpected error occurred |

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

## File Structure

```
dpma/
├── src/
│   ├── index.ts                 # Application entry point
│   ├── comprehensive-test.ts    # Test suite for all scenarios
│   ├── test-combined-mark.ts    # Word mark test script
│   ├── api/
│   │   └── server.ts            # Express server & routes
│   ├── client/
│   │   └── DPMAClient.ts        # DPMA HTTP client
│   ├── types/
│   │   └── dpma.ts              # TypeScript type definitions
│   └── validation/
│       └── validateRequest.ts   # Request validation
├── receipts/                     # Downloaded ZIP archives (auto-created)
├── debug/                        # Debug files when DEBUG=true (auto-created)
├── package.json
├── tsconfig.json
└── README.md
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DEBUG` | `false` | Enable debug logging and file output |
| `NODE_ENV` | `development` | Environment mode |

## Important Notes

1. **Real Submissions**: This API submits REAL trademark applications to DPMA. Each submission incurs real fees (minimum 290 EUR).

2. **Payment Deadline**: After submission, payment must be made within **3 months** using the provided bank details and the `aktenzeichen` as payment reference. Failure to pay results in automatic withdrawal of the application.

3. **Receipt Storage**: Receipt ZIP archives are automatically saved to the `receipts/` folder with the format `{aktenzeichen}_documents.zip`.

4. **Debug Mode**: When `DEBUG=true`, detailed logs are output and response XMLs are saved to the `debug/` folder for troubleshooting.

5. **Nice Class Terms**: Terms must use the exact German names as shown in the DPMA form. The API searches for terms and selects matching checkboxes.

6. **Image Trademarks**: Currently word marks are fully supported. Image and combined marks require image upload which is partially implemented.

7. **Delivery Address**: By default, the applicant's address is used. Set `deliveryAddress` with a different address if needed.

## Testing

The project includes a comprehensive test suite that covers various registration scenarios.

```bash
# List all available test scenarios
npx ts-node src/comprehensive-test.ts --list

# Run validation tests only (no DPMA connection)
npx ts-node src/comprehensive-test.ts --validate-only

# Test invalid request detection
npx ts-node src/comprehensive-test.ts --invalid

# Run dry-run test (connects to DPMA, stops before final submission)
npx ts-node src/comprehensive-test.ts --dry-run --scenario 1
```

### Test Modes

| Mode | Description |
|------|-------------|
| `--validate-only` | Validates all test scenarios without connecting to DPMA |
| `--invalid` | Tests that invalid requests are properly rejected |
| `--dry-run` | Connects to DPMA and runs through steps 1-7, but stops before final submission |
| `--list` | Lists all available test scenarios |

### Test Scenarios

The test suite includes 12 scenarios covering:
- Natural persons and legal entities
- Word marks, image marks, and combined marks
- Nice class term selection
- Accelerated examination option
- Delivery addresses
- Representatives
- International applicants (Austria, Switzerland)

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
