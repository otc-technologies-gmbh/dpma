/**
 * CountryMapper - Maps ISO country codes to German display names
 */

/**
 * Map of ISO country codes to German display names
 */
export const COUNTRY_MAP: Record<string, string> = {
  'DE': 'Deutschland',
  'AT': 'Österreich',
  'CH': 'Schweiz',
  'FR': 'Frankreich',
  'IT': 'Italien',
  'ES': 'Spanien',
  'NL': 'Niederlande',
  'BE': 'Belgien',
  'PL': 'Polen',
  'GB': 'Großbritannien',
  'US': 'Vereinigte Staaten von Amerika',
};

/**
 * Convert an ISO country code to its German display name
 * If the country code is not found, returns the input unchanged
 *
 * @param countryCode - The ISO country code (e.g., 'DE', 'AT')
 * @returns The German display name for the country
 */
export function getCountryDisplayName(countryCode: string): string {
  return COUNTRY_MAP[countryCode] || countryCode;
}
