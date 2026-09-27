const configuredApiUrl = (import.meta as any).env?.VITE_API_URL || '';

// Production uses relative /api URLs so Vercel can proxy them to Railway.
// Local development can still use VITE_API_URL for the separate backend.
export const API_BASE_URL = (import.meta as any).env?.DEV ? configuredApiUrl.replace(/\/$/, '') : '';

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  const token = localStorage.getItem('aqua-ledger-session-token');
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const text = await response.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const message = payload?.error || payload?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

export function apiJson<T>(path: string, body: unknown, method = 'POST'): Promise<T> {
  return apiRequest<T>(path, { method, body: JSON.stringify(body) });
}
