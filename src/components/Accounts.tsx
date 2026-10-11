import { useEffect, useMemo, useState } from 'react';
import { Building2, Download, Loader2, RefreshCw, Users, WalletCards } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { InvoiceTemplate, getCurrencySymbol } from '../lib/settings';

type AccountType = 'customer' | 'vendor';

interface AccountRow {
  id: string;
  type: AccountType;
  name: string;
  email: string;
  phone: string;
  companyName: string;
  outstanding: number;
  overpaid: number;
  totalBilled: number;
  totalPaid: number;
  invoiceCount: number;
  lastInvoice: string;
  lastInvoiceDate: string;
  lastInvoiceTotal: number;
}

interface AccountsProps {
  template?: InvoiceTemplate | null;
}

const money = (value: number, symbol: string) => `${symbol}${Math.round(Number(value) || 0).toLocaleString('en-US')}`;

export default function Accounts({ template }: AccountsProps) {
  const [accountType, setAccountType] = useState<AccountType>('customer');
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const currencySymbol = getCurrencySymbol(template?.currency || 'USD');

  const loadAccounts = async () => {
    setLoading(true);
    setError('');
    try {
      setAccounts(await apiRequest<AccountRow[]>(`/api/accounts?type=${accountType}`));
    } catch (err: any) {
      setError(err?.message || 'Could not load accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [accountType]);

  const totals = useMemo(() => accounts.reduce((result, account) => ({
    billed: result.billed + account.totalBilled,
    outstanding: result.outstanding + account.outstanding,
    overpaid: result.overpaid + account.overpaid,
  }), { billed: 0, outstanding: 0, overpaid: 0 }), [accounts]);

  const formatDate = (value: string) => {
    if (!value) return '—';
    const date = new Date(`${value.slice(0, 10)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
  };

  const downloadCsv = () => {
    const headers = ['Name', 'Company', 'Outstanding balance', 'Overpaid', 'Last invoice date', 'Last invoice total'];
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = accounts.map((account) => [
      account.name,
      account.companyName,
      account.outstanding,
      account.overpaid,
      account.lastInvoiceDate || '',
      account.lastInvoice ? account.lastInvoiceTotal : '',
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${accountType}-accounts.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="accounts-print-root space-y-6">
      <style>{`
        @media print {
          .accounts-no-print { display: none !important; }
          .accounts-print-root { position: absolute; inset: 0; width: 100%; padding: 24px; background: white; }
          .accounts-print-table { box-shadow: none !important; border: 1px solid #ddd; }
          .accounts-print-table tr { break-inside: avoid; }
        }
      `}</style>

      <div className="accounts-no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-ink rounded-full p-1.5">
          <button type="button" onClick={() => setAccountType('customer')} className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-[12px] font-bold transition-colors cursor-pointer ${accountType === 'customer' ? 'bg-brand text-white' : 'text-white/65 hover:text-white'}`}>
            <Users className="w-3.5 h-3.5" /> Customers
          </button>
          <button type="button" onClick={() => setAccountType('vendor')} className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-[12px] font-bold transition-colors cursor-pointer ${accountType === 'vendor' ? 'bg-brand text-white' : 'text-white/65 hover:text-white'}`}>
            <Building2 className="w-3.5 h-3.5" /> Vendors
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={loadAccounts} disabled={loading} className="flex items-center gap-2 bg-mist hover:bg-mist-2 text-ink text-[12px] font-bold px-4 py-3 rounded-full cursor-pointer disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button type="button" onClick={downloadCsv} disabled={loading || accounts.length === 0} className="flex items-center gap-2 bg-brand hover:bg-brand-mid text-white text-[12px] font-bold px-4 py-3 rounded-full cursor-pointer disabled:opacity-50">
            <Download className="w-3.5 h-3.5" /> Download CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-shell rounded-[22px] p-5 shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)]"><p className="text-[10px] font-bold text-quill-soft uppercase tracking-wider">{accountType === 'customer' ? 'Customers' : 'Vendors'}</p><p className="nums text-[25px] font-extrabold text-ink mt-2">{accounts.length}</p></div>
        <div className="bg-shell rounded-[22px] p-5 shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)]"><p className="text-[10px] font-bold text-quill-soft uppercase tracking-wider">Outstanding balance</p><p className="nums text-[25px] font-extrabold text-ink mt-2">{money(totals.outstanding, currencySymbol)}</p></div>
        <div className="bg-shell rounded-[22px] p-5 shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)]"><p className="text-[10px] font-bold text-quill-soft uppercase tracking-wider">Total billed</p><p className="nums text-[25px] font-extrabold text-ink mt-2">{money(totals.billed, currencySymbol)}</p></div>
      </div>

      {error && <div className="bg-[#fdf0ec] text-[#a8492f] rounded-2xl px-4 py-3 text-[12px] font-semibold">{error}</div>}

      <section className="accounts-print-table bg-shell rounded-[26px] overflow-hidden shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)]">
        <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-5 border-b border-hairline">
          <div><h2 className="text-[18px] font-extrabold text-ink font-display">{accountType === 'customer' ? 'Customer accounts' : 'Vendor accounts'}</h2><p className="text-[12px] text-quill-soft font-medium mt-1">Sorted by highest outstanding balance</p></div>
          <WalletCards className="accounts-no-print w-5 h-5 text-brand" />
        </div>
        {loading ? <div className="py-16 text-center text-quill"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" /><p className="text-[12px] font-semibold">Loading accounts…</p></div> : accounts.length === 0 ? <div className="py-16 text-center text-quill-soft text-[12px] font-semibold">No {accountType} accounts found.</div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left border-collapse">
              <thead><tr className="bg-mist/60 border-b border-hairline"><th className="px-5 sm:px-7 py-3 text-[10px] font-bold text-quill uppercase tracking-wider">Name</th><th className="px-4 py-3 text-[10px] font-bold text-quill uppercase tracking-wider">Email</th><th className="px-4 py-3 text-[10px] font-bold text-quill uppercase tracking-wider">Last invoice</th><th className="px-4 py-3 text-right text-[10px] font-bold text-quill uppercase tracking-wider">Last invoice total</th><th className="px-5 sm:px-7 py-3 text-right text-[10px] font-bold text-quill uppercase tracking-wider">Outstanding balance</th></tr></thead>
              <tbody>{accounts.map((account) => <tr key={account.id} className="border-b border-hairline last:border-0 hover:bg-mist/40"><td className="px-5 sm:px-7 py-4"><div className="text-[13px] font-extrabold text-ink">{account.name || '—'}</div>{account.companyName && <div className="text-[11px] text-quill-soft mt-0.5">{account.companyName}</div>}</td><td className="px-4 py-4 text-[12px] font-semibold text-quill break-all">{account.email || '—'}</td><td className="px-4 py-4"><div className="text-[12px] font-bold text-ink">{account.lastInvoice ? `#${account.lastInvoice}` : '—'}</div><div className="text-[11px] text-quill-soft mt-0.5">{formatDate(account.lastInvoiceDate)}</div></td><td className="nums px-4 py-4 text-right text-[13px] font-extrabold text-ink">{account.lastInvoice ? money(account.lastInvoiceTotal, currencySymbol) : '—'}</td><td className={`nums px-5 sm:px-7 py-4 text-right text-[13px] font-extrabold ${account.outstanding > 0 ? 'text-[#b36d19]' : 'text-[#3f9c68]'}`}>{money(account.outstanding, currencySymbol)}{account.overpaid > 0 && <div className="text-[10px] font-bold text-[#2d76c7] mt-1">Credit {money(account.overpaid, currencySymbol)}</div>}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
