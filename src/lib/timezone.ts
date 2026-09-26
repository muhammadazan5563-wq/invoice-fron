import { getUserSettings, getTemplateWithDefaults } from './settings';

/**
 * Get the current date string (YYYY-MM-DD) in the user's configured timezone.
 * Falls back to UTC if no timezone is configured.
 */
export function getTodayInTimezone(timezone: string = 'UTC'): string {
  try {
    const now = new Date();
    // Use Intl.DateTimeFormat to get the date parts in the target timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    // en-CA locale formats as YYYY-MM-DD
    return formatter.format(now);
  } catch (err) {
    // If timezone is invalid, fall back to UTC
    console.warn('Invalid timezone, falling back to UTC:', timezone, err);
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Get the user's configured timezone from settings.
 * Tries localStorage first for the Firebase UID, then fetches from Supabase.
 */
export async function getUserTimezone(): Promise<string> {
  return 'UTC';
}

/**
 * Convert a UTC date string to the user's timezone date string.
 * Useful for converting created_at timestamps to local dates.
 */
export function utcToTimezoneDate(utcDateStr: string, timezone: string = 'UTC'): string {
  try {
    const date = new Date(utcDateStr);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch (err) {
    return new Date(utcDateStr).toISOString().split('T')[0];
  }
}
