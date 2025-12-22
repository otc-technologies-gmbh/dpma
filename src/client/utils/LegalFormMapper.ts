/**
 * LegalFormMapper - Maps legal form abbreviations to DPMA dropdown values
 */

/**
 * Map of common legal form abbreviations to their full DPMA dropdown values
 */
export const LEGAL_FORM_MAP: Record<string, string> = {
  'GmbH': 'Gesellschaft mit beschränkter Haftung (GmbH)',
  'AG': 'Aktiengesellschaft (AG)',
  'UG': 'Unternehmergesellschaft, haftungsbeschränkt (UG)',
  'KG': 'Kommanditgesellschaft (KG)',
  'OHG': 'Offene Handelsgesellschaft (oHG)',
  'oHG': 'Offene Handelsgesellschaft (oHG)',
  'GbR': 'Gesellschaft bürgerlichen Rechts (GbR)',
  'eG': 'eingetragene Genossenschaft (eG)',
  'eV': 'eingetragener Verein (eV)',
  'e.V.': 'eingetragener Verein (eV)',
  'SE': 'europäische Gesellschaft (SE)',
  'KGaA': 'Kommanditgesellschaft auf Aktien (KGaA)',
  'PartG': 'Partnerschaftsgesellschaft (PartG)',
  'PartGmbB': 'Partnerschaftsgesellschaft mit beschränkter Berufshaftung (PartGmbB)',
};

/**
 * Map a legal form abbreviation to its full DPMA dropdown value
 * If the abbreviation is not found, returns the input unchanged
 *
 * @param abbreviation - The legal form abbreviation (e.g., 'GmbH', 'AG')
 * @returns The full DPMA dropdown value
 */
export function mapLegalForm(abbreviation: string): string {
  return LEGAL_FORM_MAP[abbreviation] || abbreviation;
}
