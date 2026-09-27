import { apiRequest, apiJson } from './api';

export interface LedgerInvoice { id: string; invoice_id: string; ledger_date: string; guest_name: string; hotel_name: string; total_amount: number; created_at: string; }
export interface CashExpense { id: number; name: string; amount: number; description: string; tag: string; created_at: string; }
export interface LedgerEntry { date: string; invoices: LedgerInvoice[]; expenses: CashExpense[]; totalReceived: number; totalExpense: number; }

export async function getLedgerInvoices(): Promise<LedgerInvoice[]> {
  const data = await apiRequest<LedgerInvoice[]>('/api/ledger-invoices');
  return (data || []).map((row) => ({ ...row, total_amount: Number(row.total_amount || 0) }));
}
export async function getCashExpenses(): Promise<CashExpense[]> {
  const data = await apiRequest<CashExpense[]>('/api/cash-expenses');
  return (data || []).map((row) => ({ ...row, amount: Number(row.amount || 0) }));
}
export async function createCashExpense(expense: Omit<CashExpense, 'id' | 'created_at'>): Promise<void> { await apiJson('/api/cash-expenses', expense); }
export async function deleteLedgerInvoice(id: string): Promise<void> { await apiRequest(`/api/ledger-invoices/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
export async function deleteCashExpense(id: number): Promise<void> { await apiRequest(`/api/cash-expenses/${encodeURIComponent(String(id))}`, { method: 'DELETE' }); }
export async function saveLedgerDay(payload: { ledger_date: string; invoices: Array<Omit<LedgerInvoice, 'created_at'>>; deleteExpenseIds: number[]; expenses: Array<Omit<CashExpense, 'id' | 'created_at'>> }): Promise<void> {
  await apiJson('/api/ledger/bulk', payload);
}
export async function deleteLedgerDay(ledgerDate: string): Promise<void> {
  await apiRequest('/api/ledger/bulk', { method: 'DELETE', body: JSON.stringify({ ledger_date: ledgerDate }) });
}

function toDateInTimezone(utcDateStr: string, timezone = 'UTC'): string {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(utcDateStr)); }
  catch { return new Date(utcDateStr).toISOString().split('T')[0]; }
}

function normalizeLedgerDate(value: string, timezone = 'UTC'): string {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
  return toDateInTimezone(raw, timezone);
}

export function groupLedgerByDate(invoices: LedgerInvoice[], expenses: CashExpense[], timezone = 'UTC'): LedgerEntry[] {
  const dateMap = new Map<string, LedgerEntry>();
  invoices.forEach((inv) => {
    const date = normalizeLedgerDate(inv.ledger_date || inv.id.match(/_(\d{4}-\d{2}-\d{2})$/)?.[1] || inv.created_at, timezone);
    if (!dateMap.has(date)) dateMap.set(date, { date, invoices: [], expenses: [], totalReceived: 0, totalExpense: 0 });
    const entry = dateMap.get(date)!;
    entry.invoices.push(inv); entry.totalReceived += inv.total_amount;
  });
  expenses.forEach((exp) => {
    const date = toDateInTimezone(exp.created_at, timezone);
    if (!dateMap.has(date)) dateMap.set(date, { date, invoices: [], expenses: [], totalReceived: 0, totalExpense: 0 });
    const entry = dateMap.get(date)!;
    entry.expenses.push(exp);
    if (exp.tag === 'cash') entry.totalReceived += exp.amount; else entry.totalExpense += exp.amount;
  });
  return Array.from(dateMap.values()).sort((a, b) => b.date.localeCompare(a.date));
}
