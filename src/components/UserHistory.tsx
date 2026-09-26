import { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, FileText, Search, UserRound, WalletCards, XCircle } from 'lucide-react';
import { Contact } from '../lib/contacts';
import { getInvoicesPage } from '../lib/invoices';
import { Invoice } from '../types';
import { InvoiceTemplate, getCurrencySymbol } from '../lib/settings';
import type { LucideIcon } from 'lucide-react';

interface UserHistoryProps {
  contacts: Contact[];
  template?: InvoiceTemplate | null;
}

const money = (value: number, symbol: string) =>
  `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function UserHistory({ contacts, template }: UserHistoryProps) {
  const [contactType, setContactType] = useState<'customer' | 'vendor'>('customer');
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromMonth, setFromMonth] = useState('');
  const [toMonth, setToMonth] = useState('');
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({ customerId: '', status: '', fromMonth: '', toMonth: '', search: '' });
  const currencySymbol = getCurrencySymbol(template?.currency || 'PKR');

  const matches = useMemo(() => {
    const term = contactSearch.trim().toLowerCase();
    if (!term || selectedContact) return [];
    return contacts
      .filter((contact) => contact.type === contactType)
      .filter((contact) => [contact.fullName, contact.email, contact.phone, contact.companyName].some((value) => (value || '').toLowerCase().includes(term)))
      .slice(0, 8);
  }, [contactSearch, contactType, contacts, selectedContact]);

  const chooseContact = async (contact: Contact) => {
    setSelectedContact(contact);
    setContactSearch(contact.fullName);
    setSearched(true);
    setLoading(true);
    try {
      const all: Invoice[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const result = await getInvoicesPage({
          page,
          limit: 300,
          invoiceType: contact.type === 'vendor' ? 'vendor' : 'customer',
          customerId: contact.id,
        });
        all.push(...result.invoices);
        hasMore = result.hasMore;
        page += 1;
      }
      setInvoices(all);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const months = useMemo(() => Array.from(new Set(invoices.map((invoice) => {
    const date = new Date(invoice.date);
    return isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }).filter(Boolean))).sort(), [invoices]);

  const monthLabel = (key: string) => {
    const [year, month] = key.split('-');
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const filteredInvoices = useMemo(() => invoices.filter((invoice) => {
    if (appliedFilters.status && appliedFilters.status !== 'all' && invoice.status !== appliedFilters.status) return false;
    const query = appliedFilters.search.toLowerCase();
    if (query && !invoice.id.toLowerCase().includes(query)) return false;
    if (appliedFilters.fromMonth || appliedFilters.toMonth) {
      const date = new Date(invoice.date);
      if (isNaN(date.getTime())) return false;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (appliedFilters.fromMonth && key < appliedFilters.fromMonth) return false;
      if (appliedFilters.toMonth && key > appliedFilters.toMonth) return false;
    }
    return true;
  }), [appliedFilters, invoices]);

  const totals = useMemo(() => {
    const billed = filteredInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
    const paid = filteredInvoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0);
    const outstanding = filteredInvoices.reduce((sum, invoice) => sum + Math.max(invoice.balance, 0), 0);
    const settled = filteredInvoices.filter((invoice) => invoice.balance <= 0).length;
    const overdue = filteredInvoices.filter((invoice) => invoice.status === 'Overdue').length;
    return { billed, paid, outstanding, settled, overdue };
  }, [filteredInvoices]);

  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (fromMonth ? 1 : 0) + (toMonth ? 1 : 0) + (invoiceQuery.trim() ? 1 : 0);

  const applyFilters = () => setAppliedFilters({
    customerId: '',
    status: statusFilter === 'all' ? '' : statusFilter,
    fromMonth,
    toMonth,
    search: invoiceQuery.trim().toLowerCase(),
  });

  const resetFilters = () => {
    setStatusFilter('all'); setFromMonth(''); setToMonth(''); setInvoiceQuery('');
    setAppliedFilters({ customerId: '', status: '', fromMonth: '', toMonth: '', search: '' });
  };

  const clearSelection = () => {
    setSelectedContact(null);
    setContactSearch('');
    setInvoices([]);
    setSearched(false);
  };

  const summaryCards: Array<[string, string, string, LucideIcon]> = [
    ['Total billed', money(totals.billed, currencySymbol), 'bg-ink text-white', FileText],
    ['Total paid', money(totals.paid, currencySymbol), 'bg-mist text-ink', CheckCircle2],
    ['Outstanding', money(totals.outstanding, currencySymbol), 'bg-brand text-white', WalletCards],
    ['Settled invoices', String(totals.settled), 'bg-mist text-ink', CheckCircle2],
    ['Overdue', String(totals.overdue), 'bg-[#fff1ec] text-[#a8492f]', Clock3],
  ];

  return (
    <div className="space-y-6 animate-fade-in" id="user-history-panel">
      <section className="bg-ink rounded-[28px] p-6 sm:p-8 text-white overflow-visible relative z-30">
        <div className="absolute -right-16 -top-20 w-64 h-64 rounded-full bg-brand/25 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand flex items-center justify-center shrink-0"><Search className="w-5 h-5" /></div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-soft">Individual history</p>
              <h2 className="text-[24px] sm:text-[30px] font-extrabold font-display tracking-tight mt-1">Search a complete account</h2>
              <p className="text-[12px] text-white/55 font-medium mt-2 max-w-xl">Review every invoice, payment and outstanding balance for one customer or vendor in one place.</p>
            </div>
          </div>
          <div className="mt-7 grid grid-cols-1 sm:grid-cols-[170px_1fr_auto] gap-2.5 items-end">
            <label className="block"><span className="block text-[10px] font-bold uppercase tracking-wider text-white/45 mb-2">Account type</span><select value={contactType} onChange={(event) => { setContactType(event.target.value as 'customer' | 'vendor'); clearSelection(); }} className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-[12px] font-semibold text-white outline-none focus:border-brand-soft"><option value="customer" className="text-ink">Customer</option><option value="vendor" className="text-ink">Vendor</option></select></label>
            <div className="relative">
              <label htmlFor="history-contact" className="block text-[10px] font-bold uppercase tracking-wider text-white/45 mb-2">Search name, email or phone</label>
              <input id="history-contact" value={contactSearch} onChange={(event) => { setContactSearch(event.target.value); setSelectedContact(null); setSearched(false); }} placeholder={`Search ${contactType}...`} className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-[12px] font-semibold text-white placeholder:text-white/30 outline-none focus:border-brand-soft" />
              {matches.length > 0 && <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-shell rounded-2xl shadow-xl border border-hairline overflow-hidden">{matches.map((contact) => <button type="button" key={contact.id} onClick={() => chooseContact(contact)} className="w-full text-left px-4 py-3 hover:bg-mist text-[12px] font-bold text-ink"><span>{contact.fullName}</span><span className="block text-[10px] text-quill font-medium mt-0.5">{contact.email || contact.phone || contact.companyName || 'No contact details'}</span></button>)}</div>}
            </div>
            <button type="button" onClick={clearSelection} disabled={!selectedContact && !contactSearch} className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 disabled:opacity-35 text-white text-[12px] font-bold px-4 py-3 rounded-xl cursor-pointer"><XCircle className="w-4 h-4" /> Clear</button>
          </div>
        </div>
      </section>

      {!selectedContact && !loading && <section className="bg-shell border border-hairline rounded-[26px] p-12 text-center"><span className="w-14 h-14 rounded-2xl bg-brand-pale text-brand flex items-center justify-center mx-auto"><UserRound className="w-6 h-6" /></span><h3 className="text-[17px] font-extrabold text-ink font-display mt-4">Choose an account to begin</h3><p className="text-[12px] text-quill-soft font-medium mt-2">Search for a customer or vendor above to open their complete financial history.</p></section>}

      {loading && <section className="bg-shell border border-hairline rounded-[26px] p-14 text-center"><div className="w-9 h-9 border-[3px] border-hairline border-t-brand rounded-full animate-spin mx-auto" /><p className="text-[12px] font-bold text-quill mt-4">Loading the complete account history…</p></section>}

      {selectedContact && !loading && <>
        <section className="bg-shell border border-hairline rounded-[26px] p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-2xl bg-brand-pale text-brand flex items-center justify-center"><UserRound className="w-5 h-5" /></div><div><h3 className="text-[17px] font-extrabold text-ink font-display">{selectedContact.fullName}</h3><p className="text-[11px] text-quill-soft font-medium mt-1">{selectedContact.email || selectedContact.phone || 'No contact details'} · {selectedContact.type}</p></div></div><span className="nums text-[11px] font-bold text-brand bg-brand-pale px-3.5 py-2 rounded-full">{filteredInvoices.length} matching invoice{filteredInvoices.length === 1 ? '' : 's'}</span>
        </section>

        <section className="flex flex-wrap items-center gap-2.5 py-1" id="history-filter-strip">
          <div className="flex items-center gap-2 mr-1"><span className="text-[12px] font-bold text-ink">Active filters</span><span className="nums w-6 h-6 rounded-full bg-mist-2 text-ink text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span></div>
          <div className="relative"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter history by status" className="select-bare bg-mist hover:bg-mist-2 text-[12px] font-semibold text-ink pl-4 pr-9 py-3 rounded-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand min-w-[135px]"><option value="all">All statuses</option>{['Paid', 'Due', 'Unpaid', 'Pending', 'Overdue'].map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
          <div className="relative"><select value={fromMonth} onChange={(event) => setFromMonth(event.target.value)} aria-label="Filter history from month" className="select-bare bg-mist hover:bg-mist-2 text-[12px] font-semibold text-ink pl-4 pr-10 py-3 rounded-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand min-w-[160px]"><option value="">From: any month</option>{months.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}</select><CalendarDays className="w-3.5 h-3.5 text-quill absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" /></div>
          <div className="relative"><select value={toMonth} onChange={(event) => setToMonth(event.target.value)} aria-label="Filter history to month" className="select-bare bg-mist hover:bg-mist-2 text-[12px] font-semibold text-ink pl-4 pr-10 py-3 rounded-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand min-w-[160px]"><option value="">To: any month</option>{months.map((month) => <option key={month} value={month}>{monthLabel(month)}</option>)}</select><CalendarDays className="w-3.5 h-3.5 text-quill absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" /></div>
          <div className="relative flex-1 min-w-[160px] max-w-[260px]"><input type="text" value={invoiceQuery} onChange={(event) => setInvoiceQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') applyFilters(); }} placeholder="Enter invoice #" aria-label="Search account invoices" className="w-full bg-mist hover:bg-mist-2 focus:bg-mist-2 text-[12px] font-semibold text-ink placeholder:text-quill-soft pl-4 pr-10 py-2.5 rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" /><Search className="w-4 h-4 text-quill absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" /></div>
          <button type="button" onClick={applyFilters} className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-mid text-white text-[12px] font-bold px-4 py-2.5 rounded-full cursor-pointer"><Search className="w-3.5 h-3.5" /> Search</button>
          <button type="button" onClick={resetFilters} className="text-[11px] font-bold text-quill hover:text-brand px-2 py-2 cursor-pointer">Reset</button>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {summaryCards.map(([label, value, tone, Icon]) => <div key={label} className={`${tone} rounded-[22px] p-5`}><Icon className="w-4 h-4 opacity-70" /><span className="block text-[10px] font-bold uppercase tracking-wider opacity-60 mt-4">{label}</span><strong className="nums block text-[22px] font-extrabold font-display mt-2 leading-none">{value}</strong></div>)}
        </section>

        <section className="bg-shell border border-hairline rounded-[26px] overflow-hidden">
          <div className="px-6 py-5 border-b border-hairline flex items-center justify-between gap-3"><div><h3 className="text-[18px] font-extrabold text-ink font-display">Invoice history</h3><p className="text-[11px] text-quill-soft font-medium mt-1">Complete chronological record for this account.</p></div><CalendarDays className="w-5 h-5 text-brand" /></div>
          {filteredInvoices.length === 0 ? <div className="p-12 text-center"><FileText className="w-7 h-7 text-quill-soft mx-auto" /><p className="text-[13px] font-bold text-ink mt-3">No invoices match these filters.</p></div> : <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="bg-mist text-[10px] uppercase tracking-wider text-quill-soft"><th className="px-6 py-3">Invoice</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Billed</th><th className="px-4 py-3 text-right">Paid</th><th className="px-4 py-3 text-right">Balance</th><th className="px-6 py-3 text-center">Status</th></tr></thead><tbody>{filteredInvoices.map((invoice) => <tr key={invoice.id} className="border-t border-hairline text-[12px] hover:bg-mist/60"><td className="px-6 py-4 font-extrabold text-brand">#{invoice.id}</td><td className="px-4 py-4 text-quill font-semibold">{invoice.date || '—'}</td><td className="px-4 py-4 text-right nums font-bold text-ink">{money(invoice.totalAmount, currencySymbol)}</td><td className="px-4 py-4 text-right nums font-semibold text-[#3f9c68]">{money(invoice.amountPaid, currencySymbol)}</td><td className="px-4 py-4 text-right nums font-bold text-[#a8492f]">{money(Math.max(invoice.balance, 0), currencySymbol)}</td><td className="px-6 py-4 text-center"><span className={`inline-flex px-3 py-1.5 rounded-full text-[10px] font-bold ${invoice.balance <= 0 ? 'bg-[#e8f7ee] text-[#2f6b48]' : invoice.status === 'Overdue' ? 'bg-[#fdeeea] text-[#a8492f]' : 'bg-[#fdf3e2] text-[#8a5c17]'}`}>{invoice.balance <= 0 ? 'Paid' : invoice.status}</span></td></tr>)}</tbody></table></div>}
        </section>
      </>}
    </div>
  );
}
