import { apiRequest, apiJson } from './api';

export interface InvoiceTemplate {
  companyName: string;
  companyLogo: string;
  termsAndConditions: string;
  paymentDetails: string;
  defaultHotelName: string;
  defaultNotes: string;
  currency: string;
  timezone: string;
  taxRate: number;
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  tagline: string;
  fishSpecies: string[];
}

export interface SpreadsheetSettings {
  spreadsheetId: string;
  spreadsheetUrl: string;
  sheetName: string;
  lastSynced: string;
}

export interface UserSettings {
  id?: string;
  user_email: string;
  user_id: string;
  google_access_token: string;
  google_refresh_token: string;
  spreadsheet_settings: SpreadsheetSettings | null;
  invoice_template: InvoiceTemplate | null;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_TEMPLATE: InvoiceTemplate = {
  companyName: 'FAIZ GROUP',
  companyLogo: '',
  termsAndConditions: 'Payment is due within 30 days of invoice date.\nLate payments may incur additional charges.\nAll prices are in USD unless otherwise stated.',
  paymentDetails: 'Beneficiaire Bank of America\nSwift Sort\nAccount No.: 324 6654 7766 9992',
  defaultHotelName: '',
  defaultNotes: '',
  currency: 'USD',
  timezone: 'UTC',
  taxRate: 0,
  contactPhone: '123-456-7890',
  contactEmail: 'billing@finnova.com',
  contactAddress: '123 Anywhere St., Any City',
  tagline: 'Smart Finances, Better Business',
  fishSpecies: ['Rohu', 'Catla', 'Mrigal', 'Mahseer', 'Grass Carp', 'Silver Carp', 'Common Carp', 'Singhari', 'Khagga', 'Sole', 'Surmai', 'Pamfret', 'Hilsa', 'Bangda', 'Daman', 'Mullan', 'Mushka', 'Khaira', 'Dawan', 'Poplet', 'Dangri', 'Suwa', 'Heera', 'Kalbose', 'Pari', 'Mali', 'Chital', 'Tilapia', 'Trout', 'Snakehead', 'Sardine', 'Snapper', 'Grouper', 'Barracuda', 'Cobia', 'Threadfin', 'Mullet', 'Seabass', 'Emperor', 'Kingfish', 'Tuna', 'Dolphin Fish', 'Ribbonfish', 'Eel', 'Catfish', 'Skate', 'Ray', 'Butterfish', 'Grunt', 'Trevally'],
};

export const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', PKR: '₨', AED: 'د.إ', SAR: '﷼', INR: '₹' };
export function getCurrencySymbol(currencyCode: string): string { return `${CURRENCY_SYMBOLS[currencyCode] || currencyCode} `; }
export function formatCurrency(amount: number, currencyCode = 'USD', options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }): string {
  return `${getCurrencySymbol(currencyCode)}${amount.toLocaleString(undefined, { minimumFractionDigits: options?.minimumFractionDigits ?? 0, maximumFractionDigits: options?.maximumFractionDigits ?? 0 })}`;
}

const DEFAULT_SPREADSHEET: SpreadsheetSettings = { spreadsheetId: '', spreadsheetUrl: '', sheetName: '', lastSynced: '' };

export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  return apiRequest<UserSettings | null>(`/api/settings/${encodeURIComponent(userId)}`);
}

export async function saveUserSettings(settings: Partial<UserSettings> & { user_id: string }): Promise<void> {
  await apiJson('/api/settings', settings);
}

export async function saveFirebaseToken(userId: string, email: string, token: string, refreshToken: string): Promise<void> {
  await saveUserSettings({ user_id: userId, user_email: email, google_access_token: token, google_refresh_token: refreshToken });
}

export async function getStoredToken(userId: string): Promise<{ token: string; refreshToken: string } | null> {
  const settings = await getUserSettings(userId);
  return settings?.google_access_token ? { token: settings.google_access_token, refreshToken: settings.google_refresh_token || '' } : null;
}

export async function saveSpreadsheetSettings(userId: string, spreadsheetSettings: SpreadsheetSettings): Promise<void> {
  const existing = await getUserSettings(userId);
  await saveUserSettings({ user_id: userId, user_email: existing?.user_email || '', spreadsheet_settings: spreadsheetSettings });
}

export async function saveInvoiceTemplate(userId: string, template: InvoiceTemplate): Promise<void> {
  const existing = await getUserSettings(userId);
  await saveUserSettings({ user_id: userId, user_email: existing?.user_email || '', invoice_template: template });
}

export function getTemplateWithDefaults(template: InvoiceTemplate | null): InvoiceTemplate { return { ...DEFAULT_TEMPLATE, ...(template || {}) }; }
export function getSpreadsheetWithDefaults(settings: SpreadsheetSettings | null): SpreadsheetSettings { return { ...DEFAULT_SPREADSHEET, ...(settings || {}) }; }
