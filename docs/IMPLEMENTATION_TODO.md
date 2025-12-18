# DPMA Trademark Registration - Implementation TODO

## Overview
This document tracks the implementation status of all DPMA form features.

---

## Step 1: Anmelder (Applicant)
**Status: COMPLETE**

All fields implemented:
- [x] Natural Person (Natürliche Person)
  - [x] Anrede/Titel (Salutation)
  - [x] Vorname (First Name)
  - [x] Nachname (Last Name)
  - [x] Namenszusatz (Name Suffix)
  - [x] Address fields
- [x] Legal Entity (Juristische Person)
  - [x] Rechtsform (Legal Form)
  - [x] Firmenname (Company Name)
  - [x] Address fields
- [x] Sanctions Declaration (Russia)

---

## Step 2: Anwalt/Kanzlei (Lawyer)
**Status: COMPLETE**

All fields implemented:
- [x] Optional representative support
- [x] Natural Person / Legal Entity toggle
- [x] Contact information
- [x] Lawyer ID (Rechtsanwaltskammer-ID)

---

## Step 3: Zustelladresse (Delivery Address)
**Status: COMPLETE**

All features implemented:
- [x] Support both person types:
  - [x] Natürliche Person/Privatperson (Natural Person)
  - [x] Juristische Person/Personengesellschaft (Legal Entity)
- [x] Address fields
- [x] Email field
- [x] Separate delivery address support (when `deliveryAddress` field is provided)
- [x] Copy from applicant support (default behavior / `copyFromApplicant: true`)
- [x] Full contact info (phone, fax, email) support

### Implementation Notes:
- Updated `submitDeliveryAddress()` in `DPMAClient.ts` to:
  - Check if `request.deliveryAddress` is provided
  - Use separate delivery address data when available
  - Fall back to copying from applicant (backwards compatible)
  - Support independent person type selection for delivery address

---

## Step 4: Marke (Trademark)
**Status: COMPLETE**

All trademark types implemented:
- [x] Wortmarke (Word Mark) - WORKING
- [x] Bildmarke (Image Mark) - IMPLEMENTED
- [x] Wort-/Bildmarke (Combined Mark) - IMPLEMENTED
- [x] 3D Marke - IMPLEMENTED
- [x] Color elements support
- [x] Non-Latin characters flag
- [x] Description field

### Implementation Notes:
- Added `uploadTrademarkImage()` method at line 752 in `DPMAClient.ts`
- Uses multipart/form-data POST to `w7005-upload.xhtml`
- Converts images to JPEG format for upload
- Added `updateTokensFromResponse()` helper method
- Modified `submitTrademark()` to detect image marks and call upload
- Dropdown values discovered:
  - Wortmarke: `word`
  - Bildmarke: `image`
  - Wort-/Bildmarke: `figurative`
  - 3D Marke: `3D`

---

## Step 5: WDVZ (Nice Classes)
**Status: COMPLETE**

All features implemented:
- [x] Top-level Nice class selection (1-45)
- [x] Sub-class/category selection via search
- [x] Individual term selection by name
- [x] Search functionality for ~70,000 terms

### Implementation Notes:
- Enhanced `NiceClassSelection` interface in `dpma.ts` to support:
  - `terms?: string[]` - Array of specific term names to select
  - `selectClassHeader?: boolean` - Whether to select the entire class header
- Added new methods to `DPMAClient.ts`:
  - `searchNiceTerms()` - AJAX search for Nice class terms
  - `findCheckboxesByTermNames()` - Match checkboxes by title attribute
  - `selectNiceTermsBySearch()` - Main term selection method
  - `findPartialMatchCheckbox()` - Fallback for partial matches
- Modified `submitNiceClasses()` to handle both term-based and header-based selection

### Usage Example:
```typescript
niceClasses: [
  { classNumber: 9, terms: ["Software", "Anwendungssoftware"] },
  { classNumber: 42, terms: ["IT-Dienstleistungen"], selectClassHeader: false }
]
```

### Key Discovery:
- DPMA form has ~70,000 Nice classification terms
- Dynamic `j_idt` IDs change per session
- Term names in `title` attributes are stable identifiers
- Search feature filters the tree view for easy checkbox matching

---

## Step 6: Sonstiges (Additional Options)
**Status: COMPLETE**

All checkboxes implemented:
- [x] Antrag auf beschleunigte Prüfung (Accelerated examination) - +200€ fee
- [x] Gewährleistungsmarke (Certification mark)
- [x] Lizenzierung der Marke (Licensing)
- [x] Veräußerung der Marke (Disposal)

### Implementation Notes:
- Checkbox field IDs discovered via Chrome DevTools:
  - `acceleratedExamination:valueHolder_input`
  - `mark-certification-chkbox:valueHolder_input`
  - `mark-licenseIndicator-chkbox:valueHolder_input`
  - `mark-dispositionIndicator-chkbox:valueHolder_input`
- Values are submitted as form fields with value 'on' (no AJAX trigger needed)
- Implementation in `submitOptions()` method (lines 1473-1500 in DPMAClient.ts)

### Usage Example:
```typescript
options: {
  acceleratedExamination: true,  // Adds 200€ to fees
  certificationMark: false,
  licensingDeclaration: true,
  saleDeclaration: false
}
```

### Priority Claims (types defined, buttons identified):
- [ ] Foreign Priority - Button: "Hinzufügen - Ausländische Priorität"
- [ ] Exhibition Priority - Button: "Hinzufügen - Austellungspriorität"
- Note: Priority claims require additional form dialog implementation

---

## Step 7: Zahlung (Payment)
**Status: ACCEPTABLE**

Current state:
- [x] Überweisung (Bank Transfer) - WORKING
- [ ] SEPA-Lastschrift - Not implemented (acceptable for now)

---

## Step 8: Zusammenfassung (Summary)
**Status: COMPLETE**

- [x] Confirmation checkbox
- [x] Sender name field
- [x] Final submission

---

## Progress Log

| Date | Step | Action | Status |
|------|------|--------|--------|
| 2024-12-18 | - | Initial audit complete | Done |
| 2024-12-18 | - | Created this tracking document | Done |
| 2024-12-18 | 3 | Updated submitDeliveryAddress() to support both person types | Done |
| 2024-12-18 | 4 | Implemented uploadTrademarkImage() for Bildmarke/Wort-Bildmarke | Done |
| 2024-12-18 | 4 | Added support for all image-based trademark types | Done |
| 2024-12-18 | 5 | Researched Nice class hierarchy (~70,000 terms) | Done |
| 2024-12-18 | 5 | Implemented search-based term selection | Done |
| 2024-12-18 | 5 | Enhanced NiceClassSelection interface with terms support | Done |
| 2024-12-18 | 6 | Discovered checkbox field IDs via Chrome DevTools | Done |
| 2024-12-18 | 6 | Verified submitOptions() implementation works correctly | Done |
| 2024-12-18 | 6 | Tested accelerated examination adds 200€ fee | Done |

---

## Next Actions
1. (Optional) Priority claims dialog implementation for Step 6
2. All core form steps are now complete!
