import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, RefreshCw, Receipt, TrendingDown } from 'lucide-react';
import { Invoice } from '../types';
import { getExpenseReport, ExpenseReportType } from '../lib/invoices';
import { InvoiceTemplate, getCurrencySymbol } from '../lib/settings';
import { getTodayInTimezone } from '../lib/timezone';

interface ExpenseTrackerProps {
  template?: InvoiceTemplate | null;
}

const expenseOptions: Array<{ value: ExpenseReportType; label: string; key: 'baraf' | 'rickshawRent' | 'workerExpense' }> = [
  { value: 'baraf', label: 'Baraf', key: 'baraf' },
  { value: 'rickshawRent', label: 'Rickshaw Rent', key: 'rickshawRent' },
  { value: 'workerExpense', label: 'Worker Expense', key: 'workerExpense' },
];

const money = (value: number, symbol: string) => `${symbol} ${Math.round(value || 0).toLocaleString('en-US')}`;

const fieldClass = 'bg-mist hover:bg-mist-2 focus:bg-mist-2 rounded-2xl px-4 py-3 text-[12px] font-semibold text-ink outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand';

export default function ExpenseTracker({ template }: ExpenseTrackerProps) {
  const today = getTodayInTimezone(template?.timezone || 'Asia/Karachi');
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [expenseType, setExpenseType] = useState<ExpenseReportType>('baraf');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState({ totalExpense: 0, invoiceCount: 0, totalInvoiceAmount: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currencySymbol = getCurrencySymbol(template?.currency || 'USD');
  const selectedExpense = expenseOptions.find((option) => option.value === expenseType) || expenseOptions[0];

  const loadReport = async () => {
    if (!fromDate || !toDate) return;
    if (fromDate > toDate) {
      setError('The start date cannot be after the end date.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const report = await getExpenseReport(fromDate, toDate, expenseType);
      setInvoices(report.invoices);
      setSummary(report.summary);
    } catch (err: any) {
      setError(err.message || 'Could not load the expense report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    // The initial report intentionally loads once for the default date range.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseType]);

  const totalSelectedExpense = useMemo(() => invoices.reduce((sum, invoice) => sum + Number(invoice.expenses?.[selectedExpense.key] || 0), 0), [invoices, selectedExpense.key]);

  return (
    <div className="space-y-6 animate-fade-in" id="expense-tracker-panel">
      <section className="bg-shell rounded-[26px] p-6 sm:p-7 shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)]">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-brand-soft flex items-center justify-center"><TrendingDown className="w-5 h-5 text-white" /></div>
              <div>
                <h2 className="text-[19px] font-extrabold text-ink font-display tracking-tight">Invoice expenses</h2>
                <p className="text-[12px] text-quill-soft font-medium mt-1">Review vendor expenses by date and expense type.</p>
              </div>
            </div>
          </div>
          <button type="button" onClick={loadReport} disabled={loading} className="inline-flex items-center gap-2 bg-mist hover:bg-mist-2 disabled:opacity-60 text-ink text-[12px] font-bold px-4 py-3 rounded-full cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="space-y-2"><span className="block text-[10px] font-bold text-quill-soft uppercase tracking-wider">From date</span><div className="relative"><input type="date" value={fromDate} max={toDate} onChange={(e) => setFromDate(e.target.value)} className={`${fieldClass} w-full pr-10`} /><CalendarDays className="w-4 h-4 text-quill absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" /></div></label>
          <label className="space-y-2"><span className="block text-[10px] font-bold text-quill-soft uppercase tracking-wider">To date</span><div className="relative"><input type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} className={`${fieldClass} w-full pr-10`} /><CalendarDays className="w-4 h-4 text-quill absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" /></div></label>
          <label className="space-y-2"><span className="block text-[10px] font-bold text-quill-soft uppercase tracking-wider">Expense</span><select value={expenseType} onChange={(e) => setExpenseType(e.target.value as ExpenseReportType)} className={`${fieldClass} w-full cursor-pointer`}><option value="baraf">Baraf</option><option value="rickshawRent">Rickshaw Rent</option><option value="workerExpense">Worker Expense</option></select></label>
        </div>
        <button type="button" onClick={loadReport} disabled={loading} className="mt-4 bg-brand hover:bg-brand-mid disabled:opacity-60 text-white text-[12px] font-bold px-5 py-3 rounded-full cursor-pointer">Apply filters</button>
        {error && <p className="mt-4 rounded-2xl bg-[#fdf0ec] text-[#a8492f] px-4 py-3 text-[12px] font-semibold">{error}</p>}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-shell rounded-[22px] p-5"><p className="text-[10px] font-bold text-quill-soft uppercase tracking-wider">{selectedExpense.label} total</p><p className="nums text-[25px] font-extrabold text-ink mt-2">{money(summary.totalExpense || totalSelectedExpense, currencySymbol)}</p></div>
        <div className="bg-shell rounded-[22px] p-5"><p className="text-[10px] font-bold text-quill-soft uppercase tracking-wider">Invoices with expense</p><p className="nums text-[25px] font-extrabold text-ink mt-2">{summary.invoiceCount}</p></div>
        <div className="bg-shell rounded-[22px] p-5"><p className="text-[10px] font-bold text-quill-soft uppercase tracking-wider">Total invoice amount</p><p className="nums text-[25px] font-extrabold text-ink mt-2">{money(summary.totalInvoiceAmount, currencySymbol)}</p></div>
      </section>

      <section className="bg-shell rounded-[26px] p-6 sm:p-7 shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)] overflow-hidden">
        <div className="flex flex-wrap justify-between items-end gap-3 mb-5"><div><h2 className="text-[18px] font-extrabold text-ink font-display">{selectedExpense.label} invoices</h2><p className="text-[12px] text-quill-soft font-medium mt-1">{fromDate} to {toDate}</p></div><span className="nums text-[11px] font-bold text-quill bg-mist px-3 py-2 rounded-full">{invoices.length} result{invoices.length === 1 ? '' : 's'}</span></div>
        {loading ? <div className="py-12 text-center text-[12px] font-semibold text-quill">Loading expense report…</div> : invoices.length === 0 ? <div className="py-12 text-center"><Receipt className="w-8 h-8 text-quill-soft mx-auto mb-3" /><p className="text-[13px] font-bold text-ink">No matching invoices</p><p className="text-[12px] text-quill-soft mt-1">Try another date range or expense type.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[680px]"><thead><tr className="border-b border-hairline text-left"><th className="py-3 px-3 text-[10px] font-bold text-quill uppercase tracking-wider">Invoice</th><th className="py-3 px-3 text-[10px] font-bold text-quill uppercase tracking-wider">Vendor</th><th className="py-3 px-3 text-[10px] font-bold text-quill uppercase tracking-wider">Date</th><th className="py-3 px-3 text-right text-[10px] font-bold text-quill uppercase tracking-wider">{selectedExpense.label}</th><th className="py-3 px-3 text-right text-[10px] font-bold text-quill uppercase tracking-wider">Invoice total</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id} className="border-b border-hairline last:border-0 hover:bg-mist/50"><td className="py-4 px-3 text-[12px] font-bold text-ink">{invoice.id}</td><td className="py-4 px-3 text-[12px] font-semibold text-ink">{invoice.customerName || '—'}</td><td className="py-4 px-3 text-[12px] font-semibold text-quill">{invoice.date}</td><td className="nums py-4 px-3 text-right text-[12px] font-extrabold text-[#c85d3f]">{money(Number(invoice.expenses?.[selectedExpense.key] || 0), currencySymbol)}</td><td className="nums py-4 px-3 text-right text-[12px] font-bold text-ink">{money(invoice.totalAmount, currencySymbol)}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}
