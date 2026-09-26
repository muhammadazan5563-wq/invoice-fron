import { apiRequest, apiJson } from './api';

export type Role = 'admin' | 'vendor' | 'customer';
export interface AppUser { uid: string; id: string; email: string; displayName?: string; photoURL?: string | null; }
export interface Session { user: AppUser; role: Role; contact: any | null; accessToken: string | null; token?: string; }
const TOKEN_KEY = 'aqua-ledger-session-token';

function saveToken(token: string) { localStorage.setItem(TOKEN_KEY, token); }
export function getAuthToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }

export function initAuth(onSession: (session: Session) => void, onSignedOut: (reason?: string) => void) {
  const token = getAuthToken();
  if (!token) { onSignedOut(); return () => undefined; }
  apiRequest<Session>('/api/auth/session').then(onSession).catch(() => { clearToken(); onSignedOut(); });
  return () => undefined;
}
export async function emailSignIn(email: string, password: string): Promise<Session> {
  const session = await apiJson<Session>('/api/auth/login', { email, password });
  if (session.token) saveToken(session.token);
  return session;
}
export async function googleSignIn(): Promise<Session> { throw new Error('Google sign-in is no longer configured. Use the administrator email and password created on Railway.'); }
export async function refreshGoogleToken(): Promise<string | null> { return null; }
export async function logout(): Promise<void> { try { await apiJson('/api/auth/logout', {}); } finally { clearToken(); } }
