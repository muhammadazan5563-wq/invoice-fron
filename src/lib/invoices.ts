import { Invoice } from '../types';
import { apiRequest, apiJson } from './api';

function rowToInvoice(row: any): Invoice {
  const value = (camel: string, snake: string, fallback: any = '') => row[camel] ?? row[snake] ?? fallback;
  const totalAmount = Number(value('totalAmount', 'total_amount', 0));
  const amountPaid = Number(value('amountPaid', 'amount_paid', 0));
  const rawBalance = Number(value('balance', 'balance', 0));
  const balance = Math.max(0, Math.round(rawBalance * 100) / 100);
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
    totalAmount,
    taxRate: Number(value('taxRate', 'tax_rate', 0)),
    taxAmount: Number(value('taxAmount', 'tax_amount', 0)),
    expenses: { baraf: Number(expenses.baraf || 0), rickshawRent: Number(expenses.rickshawRent || 0), workerExpense: Number(expenses.workerExpense || 0) },
    expenseTotal: Number(value('expenseTotal', 'expense_total', 0)),
    amountPaid,
    paymentDate: value('paymentDate', 'payment_date'),
    balance,
    status: balance === 0 && totalAmount > 0 && amountPaid >= totalAmount ? 'Paid' : value('status', 'status', 'Pending'),
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
  return (rows || []).filter((row) => (row.invoiceType || row.invoice_type) === 'vendor').map((row) => ({ ...rowToInvoice(row), invoiceType: 'vendor' }));
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
