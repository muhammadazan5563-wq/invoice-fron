import { Invoice } from '../types';
import { apiRequest, apiJson } from './api';

function rowToInvoice(row: any): Invoice {
  return {
    rowIndex: 0,
    id: row.id,
    date: row.date,
    customerName: row.customer_name || '',
    customerId: row.customer_id || '',
    customerEmail: row.customer_email || '',
    customerPhone: row.customer_phone || '',
    totalAmount: Number(row.total_amount || 0),
    taxRate: Number(row.tax_rate || 0),
    taxAmount: Number(row.tax_amount || 0),
    expenses: { baraf: Number(row.baraf || 0), rickshawRent: Number(row.rickshaw_rent || 0), workerExpense: Number(row.worker_expense || 0) },
    expenseTotal: Number(row.expense_total || 0),
    amountPaid: Number(row.amount_paid || 0),
    paymentDate: row.payment_date || '',
    balance: Number(row.balance || 0),
    status: row.status || 'Pending',
    notes: row.notes || '',
    items: Array.isArray(row.items) ? row.items : [],
    payments: Array.isArray(row.payments) ? row.payments : [],
    rawRow: [],
    invoiceType: row.invoice_type || 'customer',
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

export async function getInvoices(): Promise<Invoice[]> {
  const rows = await apiRequest<any[]>('/api/invoices');
  return (rows || []).map(rowToInvoice);
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
  const rows = await apiRequest<any[]>('/api/invoices');
  return (rows || []).filter((row) => row.invoice_type === 'vendor').map((row) => ({ ...rowToInvoice(row), invoiceType: 'vendor' }));
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
