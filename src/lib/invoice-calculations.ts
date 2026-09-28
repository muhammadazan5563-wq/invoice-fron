/**
 * Gross amount is the invoice subtotal before commission and expenses.
 * Prefer line-item totals when available, while preserving older invoices
 * that only stored the final total and adjustment fields.
 */
export function getInvoiceGrossAmount(invoice: {
  items: Array<{ total?: number; quantity?: number; price?: number }>;
  totalAmount: number;
  taxAmount?: number;
  expenseTotal?: number;
}): number {
  if (invoice.items.length > 0) {
    return invoice.items.reduce(
      (sum, item) => sum + Number(item.total || (Number(item.quantity || 0) * Number(item.price || 0))),
      0,
    );
  }
  return Math.max(0, Number(invoice.totalAmount || 0) - Number(invoice.taxAmount || 0) - Number(invoice.expenseTotal || 0));
}
