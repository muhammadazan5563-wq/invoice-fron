import { Invoice } from '../types';
import { apiRequest, apiJson } from './api';

export interface InvoicePage {
  invoices: Invoice[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface InvoicePageOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  customerId?: string;
  fromMonth?: string;
  toMonth?: string;
  invoiceType?: 'customer' | 'vendor';
}

function rowToInvoice(row: any): Invoice {
  const value = (camel: string, snake: string, fallback: any = '') => row[camel] ?? row[snake] ?? fallback;
  const expenses = row.expenses || {
    baraf: Number(value('baraf', 'baraf', 0)),
    rickshawRent: Number(value('rickshawRent', 'rickshaw_rent', 0)),
    workerExpense: Number(value('workerExpense', 'worker_expense', 0)),
  };
  return {
    rowIndex: 0,
    id: row.id,
    date: row.date,
    customerName: value('customerName', 'customer_name'),
    customerId: value('customerId', 'customer_id'),
    customerEmail: value('customerEmail', 'customer_email'),
    customerPhone: value('customerPhone', 'customer_phone'),
    totalAmount: Number(value('totalAmount', 'total_amount', 0)),
    taxRate: Number(value('taxRate', 'tax_rate', 0)),
    taxAmount: Number(value('taxAmount', 'tax_amount', 0)),
    expenses: { baraf: Number(expenses.baraf || 0), rickshawRent: Number(expenses.rickshawRent || 0), workerExpense: Number(expenses.workerExpense || 0) },
    expenseTotal: Number(value('expenseTotal', 'expense_total', 0)),
    amountPaid: Number(value('amountPaid', 'amount_paid', 0)),
    paymentDate: value('paymentDate', 'payment_date'),
    balance: Number(value('balance', 'balance', 0)),
    status: value('status', 'status', 'Pending'),
    notes: value('notes', 'notes'),
    items: Array.isArray(row.items) ? row.items : [],
    payments: Array.isArray(row.payments) ? row.payments : [],
    rawRow: [],
    invoiceType: row.invoiceType || row.invoice_type || 'customer',
  };
}

function invoiceToRow(invoice: Omit<Invoice, 'rowIndex' | 'rawRow'>) {
  return {
    id: invoice.id,
    date: invoice.date,
    customerName: invoice.customerName,
    customerId: invoice.customerId || '',
    customerEmail: invoice.customerEmail || '',
    customerPhone: invoice.customerPhone || '',
    totalAmount: Number(invoice.totalAmount || 0),
    taxRate: Number(invoice.taxRate || 0),
    taxAmount: Number(invoice.taxAmount || 0),
    expenses: invoice.expenses || { baraf: 0, rickshawRent: 0, workerExpense: 0 },
    expenseTotal: Number(invoice.expenseTotal || 0),
    amountPaid: Number(invoice.amountPaid || 0),
    paymentDate: invoice.paymentDate || '',
    balance: Number(invoice.balance || 0),
    status: invoice.status || 'Pending',
    notes: invoice.notes || '',
    items: invoice.items || [],
    payments: invoice.payments || [],
    invoiceType: invoice.invoiceType || 'customer',
  };
}

export async function getInvoicesPage(options: InvoicePageOptions = {}): Promise<InvoicePage> {
  const params = new URLSearchParams();
  params.set('page', String(Math.max(1, options.page || 1)));
  params.set('limit', String(Math.min(600, Math.max(1, options.limit || 600))));
  if (options.search?.trim()) params.set('search', options.search.trim());
  if (options.status && options.status !== 'All') params.set('status', options.status);
  if (options.customerId) params.set('customerId', options.customerId);
  if (options.fromMonth) params.set('fromMonth', options.fromMonth);
  if (options.toMonth) params.set('toMonth', options.toMonth);
  if (options.invoiceType) params.set('invoiceType', options.invoiceType);
  const response = await apiRequest<any>(`/api/invoices?${params.toString()}`);
  const rows = Array.isArray(response) ? response : response?.invoices || [];
  return {
    invoices: rows.map(rowToInvoice),
    page: Number(response?.page || options.page || 1),
    limit: Number(response?.limit || options.limit || 600),
    total: Number(response?.total ?? rows.length),
    hasMore: Boolean(response?.hasMore ?? rows.length === (options.limit || 600)),
  };
}

export async function getInvoiceHistory(contactId: string, invoiceType: 'customer' | 'vendor'): Promise<Invoice[]> {
  const params = new URLSearchParams({ customerId: contactId, invoiceType, _ts: String(Date.now()) });
  const response = await apiRequest<{ invoices?: any[] }>(`/api/invoices/history?${params.toString()}`, { cache: 'no-store' });
  return (response.invoices || []).map(rowToInvoice);
}

export async function getLedgerInvoicesForDate(date: string): Promise<Invoice[]> {
  const response = await apiRequest<{ invoices?: any[] }>(`/api/invoices/ledger-date?date=${encodeURIComponent(date)}`);
  return (response.invoices || []).map(rowToInvoice);
}

// Kept for secondary views that need a bounded page but do not yet expose controls.
export async function getInvoices(): Promise<Invoice[]> {
  return (await getInvoicesPage()).invoices;
}

export async function createInvoice(invoice: Omit<Invoice, 'rowIndex' | 'rawRow'>): Promise<void> {
  await apiJson('/api/invoices', invoiceToRow(invoice));
}

export async function updateInvoice(id: string, invoice: Omit<Invoice, 'rowIndex' | 'rawRow'>): Promise<void> {
  await apiJson(`/api/invoices/${encodeURIComponent(id)}`, invoiceToRow(invoice), 'PUT');
}

export async function deleteInvoice(id: string, invoiceType: 'customer' | 'vendor' = 'customer'): Promise<void> {
  await apiRequest(`/api/invoices/${encodeURIComponent(id)}?invoiceType=${encodeURIComponent(invoiceType)}`, { method: 'DELETE' });
}

export async function getVendorInvoices(): Promise<Invoice[]> {
  return (await getInvoicesPage({ invoiceType: 'vendor' })).invoices;
}

export async function getPublicInvoice(rawId: string): Promise<Invoice | null> {
  try {
    const row = await apiRequest<any>(`/api/public-invoice/${encodeURIComponent(rawId)}`);
    return rowToInvoice(row);
  } catch (error: any) {
    if (error?.message === 'Invoice not found') return null;
    throw error;
  }
}

export async function syncBookingToSheet(
  invoiceId: string,
  customerName: string,
  items: Array<{ checkIn: string; checkOut: string; nights: number; quantity: number; roomType: string }>,
  spreadsheetId: string,
  sheetName: string,
  accessToken: string
): Promise<{ success: boolean; rowsAdded: number; startId: number }> {
  return apiJson('/api/sync-booking-sheet', { invoiceId, customerName, items, spreadsheetId, sheetName, accessToken });
}
