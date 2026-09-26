import { apiRequest, apiJson } from './api';

export type ContactType = 'vendor' | 'customer';
export interface Contact { id: string; type: ContactType; fullName: string; phone: string; email: string; companyName: string; location: string; address: string; area: string; taxRate: number; cnicFrontUrl: string; cnicBackUrl: string; chequeUrl: string; tempPassword: string; createdAt: string; }
export interface ContactDraft { type: ContactType; fullName: string; phone: string; email: string; password?: string; companyName?: string; location?: string; address?: string; area?: string; taxRate?: number; }
export interface ContactFiles { cnicFront?: File | null; cnicBack?: File | null; cheque?: File | null; }
export interface CreateContactResult { contact: Contact; password: string; }

export function generatePassword(length = 10) { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; const bytes = new Uint8Array(length); crypto.getRandomValues(bytes); return [...bytes].map((x) => chars[x % chars.length]).join(''); }
let cache: Contact[] | null = null;
export async function getContacts(forceRefresh = false): Promise<Contact[]> { if (cache && !forceRefresh) return cache; cache = await apiRequest<Contact[]>('/api/contacts'); return cache; }
export function invalidateContactsCache() { cache = null; }
export async function getContactByEmail(email: string): Promise<Contact | null> { return (await getContacts()).find((x) => x.email.toLowerCase() === email.trim().toLowerCase()) || null; }
export async function createContact(draft: ContactDraft, _files: ContactFiles = {}): Promise<CreateContactResult> { const result = await apiJson<CreateContactResult>('/api/contacts', draft); return result; }
export async function updateContact(contact: Contact, draft: ContactDraft, _files: ContactFiles = {}): Promise<Contact> { return apiJson<Contact>(`/api/contacts/${encodeURIComponent(contact.id)}`, draft, 'PUT'); }
