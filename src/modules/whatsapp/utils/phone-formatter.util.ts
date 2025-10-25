import { ListingSource } from '../../../entities/listing.entity';

/**
 * Utility class for formatting phone numbers to WhatsApp-compatible format
 */
export class PhoneFormatter {
  /**
   * Formats a phone number by removing non-digit characters
   * and adding country codes if missing
   *
   * @param phone - The phone number to format
   * @returns Formatted phone number with country code
   *
   * @example
   * formatPhoneNumber('0123456789') // '49123456789' (German number)
   * formatPhoneNumber('+48123456789') // '48123456789' (Polish number)
   */
  static formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let formatted = phone.replace(/\D/g, '');

    // Add country codes if missing
    if (formatted.startsWith('0')) {
      // German numbers starting with 0
      formatted = '49' + formatted.substring(1);
    } else if (formatted.length === 9 && !formatted.startsWith('48')) {
      // Polish numbers (9 digits without country code)
      formatted = '48' + formatted;
    } else if (formatted.length === 9 && !formatted.startsWith('420')) {
      // Czech numbers (9 digits without country code)
      formatted = '420' + formatted;
    }

    return formatted;
  }

  /**
   * Formats a phone number to WhatsApp chat ID format (number@c.us)
   *
   * @param phone - The phone number to format
   * @returns WhatsApp chat ID
   *
   * @example
   * toChatId('+48123456789') // '48123456789@c.us'
   */
  static toChatId(phone: string): string {
    return `${this.formatPhoneNumber(phone)}@c.us`;
  }

  /**
   * Adds source-specific country code prefix to phone number
   *
   * @param phone - The phone number
   * @param source - The listing source (otomoto, mobile.de, etc.)
   * @returns Phone number with country code prefix
   *
   * @example
   * addSourcePrefix('123456789', 'otomoto') // '+48123456789'
   * addSourcePrefix('123456789', 'mobile.de') // '123456789'
   */
  static addSourcePrefix(
    phone: string,
    source: ListingSource,
  ): string {
    if (source === ListingSource.OTOMOTO && !phone.startsWith('+')) {
      return `+48${phone}`;
    }
    return phone;
  }

  /**
   * Validates if a phone number looks valid (has minimum required digits)
   *
   * @param phone - The phone number to validate
   * @returns True if phone number appears valid
   */
  static isValidPhone(phone: string | null | undefined): boolean {
    if (!phone) return false;
    const digitsOnly = phone.replace(/\D/g, '');
    // Most valid phone numbers have at least 9 digits (including country code)
    return digitsOnly.length >= 9;
  }
}
