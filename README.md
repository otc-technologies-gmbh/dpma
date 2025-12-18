# DPMA Trademark Registration API

Automated German trademark registration via the DPMA (Deutsches Patent- und Markenamt) online portal.

## Overview

This API automates the complete trademark registration process with the German Patent and Trademark Office (DPMA). It handles:

- Session management and CSRF token handling
- Multi-step form submission (8 steps)
- Nice classification selection
- Payment method configuration
- Receipt document download

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
  "status": "ok",
  "timestamp": "2025-12-18T12:00:00.000Z"
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
        "street": "Musterstraße",
        "houseNumber": "123",
        "zip": "80331",
        "city": "München",
        "country": "DE"
      }
    },
    "email": "max@example.com",
    "sanctions": {
      "declaration": "NONE",
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
        "street": "Industriestraße",
        "houseNumber": "45",
        "zip": "10115",
        "city": "Berlin",
        "country": "DE"
      }
    },
    "email": "legal@muster-gmbh.de",
    "sanctions": {
      "declaration": "NONE",
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

## Request Schema

### Root Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `applicant` | object | Yes | Applicant information (see below) |
| `email` | string | Yes | Contact email for correspondence |
| `sanctions` | object | Yes | EU sanctions declaration (see below) |
| `trademark` | object | Yes | Trademark details (see below) |
| `niceClasses` | array | Yes | At least one Nice class (see below) |
| `leadClass` | number | No | Lead class number (defaults to first class) |
| `paymentMethod` | string | Yes | `"UEBERWEISUNG"` (bank transfer) or `"SEPA_LASTSCHRIFT"` |
| `sepaDetails` | object | Conditional | Required if paymentMethod is `"SEPA_LASTSCHRIFT"` |
| `options` | object | No | Additional options (see below) |
| `senderName` | string | Yes | Name of sender for final submission (typically applicant name) |
| `deliveryAddress` | object | No | Alternative delivery address (see below) |
| `internalReference` | string | No | Your internal reference number |

### Applicant Object

#### Natural Person (`type: "natural"`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `"natural"` |
| `salutation` | string | No | `"Herr"`, `"Frau"`, or empty |
| `firstName` | string | Yes | First name |
| `lastName` | string | Yes | Last name |
| `address` | object | Yes | Address object (see below) |

#### Legal Entity (`type: "legal"`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Must be `"legal"` |
| `companyName` | string | Yes | Company name |
| `legalForm` | string | No | Legal form (GmbH, AG, etc.) |
| `address` | object | Yes | Address object (see below) |

### Address Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `street` | string | Yes | Street name |
| `houseNumber` | string | Yes | House/building number |
| `zip` | string | Yes | Postal code (5 digits for Germany) |
| `city` | string | Yes | City name |
| `country` | string | Yes | ISO 3166-1 alpha-2 code (e.g., `"DE"`, `"AT"`, `"CH"`) |
| `addressLine1` | string | No | Additional address line |
| `addressLine2` | string | No | Additional address line |

### Delivery Address Object (Optional)

Use this if you want official correspondence sent to a different address than the applicant's address.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `street` | string | Yes | Street name |
| `houseNumber` | string | Yes | House/building number |
| `zip` | string | Yes | Postal code |
| `city` | string | Yes | City name |
| `country` | string | Yes | ISO 3166-1 alpha-2 code |
| `recipientName` | string | No | Name of recipient if different from applicant |

### Sanctions Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `declaration` | string | No | `"NONE"` (default) |
| `hasRussianNationality` | boolean | Yes | Must be `false` to proceed |
| `hasRussianResidence` | boolean | Yes | Must be `false` to proceed |

### Trademark Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | `"word"`, `"figurative"`, or `"combined"` |
| `text` | string | Conditional | Required for `"word"` type only |
| `imageData` | Buffer | Conditional | Required for `"figurative"` and `"combined"` types |
| `imageMimeType` | string | Conditional | MIME type of image (e.g., `"image/png"`, `"image/jpeg"`) |
| `imageFileName` | string | Conditional | Original filename of image |

**Note**: For `"combined"` marks, only `imageData` is required. The text is embedded within the image itself. For `"figurative"` marks, only the image is used (no text).

### Nice Classes Array

Each element in the array:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `classNumber` | number | Yes | Class number (1-45) |
| `terms` | string[] | No | Specific terms within the class (see below) |
| `selectClassHeader` | boolean | No | If true, selects the entire class header/category instead of individual terms |

#### Term Selection

You can specify terms in two ways:

1. **Select entire class header** (all terms in a category):
   ```json
   { "classNumber": 9, "selectClassHeader": true }
   ```

2. **Select specific individual terms**:
   ```json
   {
     "classNumber": 9,
     "terms": ["Computer", "Computersoftware", "Herunterladbare Computerprogramme"]
   }
   ```

3. **Default behavior** (no terms specified): Selects the first available term group in the class.

### Options Object (Optional)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `acceleratedExamination` | boolean | false | Request accelerated examination (+€200) |
| `certificationMark` | boolean | false | Register as certification mark |
| `licensingDeclaration` | boolean | false | Include licensing willingness declaration |
| `saleDeclaration` | boolean | false | Include sale willingness declaration |

### SEPA Details Object (Required for SEPA payment)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `iban` | string | Yes | Bank account IBAN |
| `bic` | string | Yes | Bank BIC/SWIFT code |
| `accountHolder` | string | Yes | Account holder name |

## Response Format

### Success Response (HTTP 201)

```json
{
  "success": true,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-12-18T12:41:05.000Z",
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
    "receipt": {
      "filename": "W7005-01.PDF",
      "mimeType": "application/octet-stream",
      "dataBase64": "JVBERi0xLjQK..."
    },
    "receiptFilePath": "/path/to/receipts/302025261416_4_W7005-01.PDF"
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
| `receipt` | Base64-encoded PDF receipt |
| `receiptFilePath` | Local file path where receipt PDF was saved |

### Error Response (HTTP 400/500)

```json
{
  "success": false,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-12-18T12:00:00.000Z",
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
| `UNKNOWN_ERROR` | Unexpected error occurred |

## Fees

| Description | Amount |
|-------------|--------|
| Base fee (1-3 classes, electronic filing) | €290 |
| Each additional class (4+) | €100 |
| Accelerated examination (optional) | €200 |

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
│   ├── index.ts              # Application entry point
│   ├── comprehensive-test.ts # Test suite for all scenarios
│   ├── api/
│   │   └── server.ts         # Express server & routes
│   ├── client/
│   │   └── DPMAClient.ts     # DPMA HTTP client
│   ├── types/
│   │   └── dpma.ts           # TypeScript type definitions
│   └── validation/
│       └── validateRequest.ts # Request validation
├── receipts/                  # Downloaded receipt PDFs (auto-created)
├── debug/                     # Debug files when DEBUG=true (auto-created)
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

1. **Real Submissions**: This API submits REAL trademark applications to DPMA. Each submission incurs real fees (minimum €290).

2. **Payment Deadline**: After submission, payment must be made within **3 months** using the provided bank details and the `aktenzeichen` as payment reference. Failure to pay results in automatic withdrawal of the application.

3. **Receipt Storage**: Receipt PDFs are automatically saved to the `receipts/` folder with the format `{aktenzeichen}_{filename}.pdf`.

4. **Debug Mode**: When `DEBUG=true`, detailed logs are output and response XMLs are saved to the `debug/` folder for troubleshooting.

5. **Nice Classes**: The API supports three modes for Nice class term selection: selecting the entire class header, selecting specific individual terms by name, or defaulting to the first available term group. See the Nice Classes Array section for details.

6. **Image Trademarks**: All trademark types are fully supported: word marks (`type: "word"`), figurative/image marks (`type: "figurative"`), and combined marks (`type: "combined"`).

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
