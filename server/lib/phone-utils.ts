// Country dial codes mapping
export const COUNTRY_DIAL_CODES: Record<string, string> = {
  "US": "+1", "CA": "+1", "GB": "+44", "AU": "+61", "NZ": "+64",
  "IE": "+353", "IN": "+91", "SG": "+65", "MX": "+52", "DE": "+49",
  "FR": "+33", "ES": "+34", "IT": "+39",
};

/**
 * Constructs E.164 phone number from country code and phone number
 * Uses the same logic as when sending messages to ensure consistency
 */
export function constructE164Phone(countryCode: string, phone: string): string {
  // Strip all non-digit characters first
  let cleaned = phone.replace(/\D/g, '');
  
  // If original started with +, handle optional trunk prefix in formats like "+44 (0)20..."
  if (phone.trim().startsWith('+')) {
    const result = '+' + cleaned;
    // For countries that don't use trunk 0 in international format, remove it if present
    // Patterns: +440... (UK), +610... (AU), +640... (NZ), etc.
    // Keep 0 for Italy (+390...)
    if (result.startsWith('+440') || result.startsWith('+610') || result.startsWith('+640') || 
        result.startsWith('+3530') || result.startsWith('+910') || result.startsWith('+650') || 
        result.startsWith('+520') || result.startsWith('+490') || result.startsWith('+330') || 
        result.startsWith('+340') || result.startsWith('+10')) {
      // Remove the trunk 0 after country code
      return result.replace(/^(\+\d{1,3})0/, '$1');
    }
    return result;
  }
  
  // Handle international access codes (check longest codes first)
  if (cleaned.startsWith('0011')) {
    cleaned = cleaned.substring(4);
  } else if (cleaned.startsWith('011')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('001')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }
  
  // Check if number already starts with a country code (after stripping access codes)
  // Common country codes from our list: 1, 33, 34, 39, 44, 49, 52, 61, 64, 65, 91, 353
  const commonCodes = ['1', '33', '34', '39', '44', '49', '52', '61', '64', '65', '91', '353'];
  for (const code of commonCodes) {
    if (cleaned.startsWith(code)) {
      // Already has country code, but may have trunk prefix after it
      const result = '+' + cleaned;
      // Remove trunk 0 after country code (except Italy)
      if (result.startsWith('+440') || result.startsWith('+610') || result.startsWith('+640') || 
          result.startsWith('+3530') || result.startsWith('+910') || result.startsWith('+650') || 
          result.startsWith('+520') || result.startsWith('+490') || result.startsWith('+330') || 
          result.startsWith('+340') || result.startsWith('+10')) {
        return result.replace(/^(\+\d{1,3})0/, '$1');
      }
      return result;
    }
  }
  
  // No country code detected, so this is a national number
  // Remove leading trunk prefix (usually 0) for most countries except Italy
  if (cleaned.startsWith('0') && countryCode !== 'IT') {
    cleaned = cleaned.substring(1);
  }
  
  // Prepend the country dial code
  const dialCode = COUNTRY_DIAL_CODES[countryCode] || "+1";
  return dialCode + cleaned;
}

/**
 * Normalizes phone numbers for comparison (removes all non-digit characters except +)
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters for comparison
  return phone.replace(/\D/g, '');
}

