import { useMemo, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, FileText, Printer, Search, UserRound, WalletCards, XCircle } from 'lucide-react';
import { Contact } from '../lib/contacts';
import { getInvoiceHistory, ContactInvoiceSummary } from '../lib/invoices';
import { Invoice } from '../types';
import { InvoiceTemplate, getCurrencySymbol } from '../lib/settings';
import { getInvoiceGrossAmount } from '../lib/invoice-calculations';
import type { LucideIcon } from 'lucide-react';

interface UserHistoryProps {
  contacts: Contact[];
  template?: InvoiceTemplate | null;
}

const money = (value: number, symbol: string) =>
  `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const BRAND_MARK = 'https://mgx-backend-cdn.metadl.com/generate/images/1500378/2026-08-01/tumdfoacajra/logo-finnova-n-mark.png';

export default function UserHistory({ contacts, template }: UserHistoryProps) {
  const [contactType, setContactType] = useState<'customer' | 'vendor'>('customer');
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [accountSummary, setAccountSummary] = useState<ContactInvoiceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({ customerId: '', status: '', fromMonth: '', toMonth: '', search: '' });
  const historyRequestRef = useRef(0);
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
    const requestId = ++historyRequestRef.current;
    setSelectedContact(contact);
    setContactSearch(contact.fullName);
    setSearched(true);
    setLoading(true);
    try {
      const invoiceType = contact.type === 'vendor' ? 'vendor' : 'customer';
      const result = await getInvoiceHistory(contact.id, invoiceType);
      if (requestId === historyRequestRef.current) { setInvoices(result.invoices); setAccountSummary(result.summary); }
    } catch {
      if (requestId === historyRequestRef.current) { setInvoices([]); setAccountSummary(null); }
    } finally {
      if (requestId === historyRequestRef.current) setLoading(false);
    }
  };

  const filteredInvoices = useMemo(() => invoices.filter((invoice) => {
    if (appliedFilters.status && appliedFilters.status !== 'all' && invoice.status !== appliedFilters.status) return false;
    const query = appliedFilters.search.toLowerCase();
    if (query && !invoice.id.toLowerCase().includes(query)) return false;
    if (appliedFilters.fromMonth || appliedFilters.toMonth) {
      const date = new Date(invoice.date);
      if (isNaN(date.getTime())) return false;
      const invoiceDate = invoice.date.slice(0, 10);
      if (appliedFilters.fromMonth && invoiceDate < appliedFilters.fromMonth) return false;
      if (appliedFilters.toMonth && invoiceDate > appliedFilters.toMonth) return false;
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

  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (fromDate ? 1 : 0) + (toDate ? 1 : 0) + (invoiceQuery.trim() ? 1 : 0);

  const applyFilters = () => setAppliedFilters({
    customerId: '',
    status: statusFilter === 'all' ? '' : statusFilter,
    fromMonth: fromDate,
    toMonth: toDate,
    search: invoiceQuery.trim().toLowerCase(),
  });

  const resetFilters = () => {
    setStatusFilter('all'); setFromDate(''); setToDate(''); setInvoiceQuery('');
    setAppliedFilters({ customerId: '', status: '', fromMonth: '', toMonth: '', search: '' });
  };

  const printHistory = () => {
    if (filteredInvoices.length === 0) return;
    const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));
    const pages = filteredInvoices.map((invoice) => {
      const grossAmount = getInvoiceGrossAmount(invoice);
      const paymentEntries = invoice.payments?.length
        ? invoice.payments
        : invoice.amountPaid > 0
          ? [{ date: invoice.paymentDate || invoice.date, amount: invoice.amountPaid }]
          : [];
      const paymentMarkup = paymentEntries.map((payment) => `<small>${escapeHtml(payment.date || '')} - ${money(payment.amount || 0, currencySymbol)}</small>`).join('');
      const items = invoice.items.length > 0
        ? invoice.items.map((item) => `<tr><td>${escapeHtml((item as any).fishSpecies || item.roomType || '—')}</td><td>${escapeHtml(item.description || '—')}</td><td class="num">${item.quantity || 0}</td>${invoice.invoiceType !== 'vendor' ? `<td class="num">${money(item.price || 0, currencySymbol)}</td>` : ''}<td class="num">${money(item.total || (item.quantity || 0) * (item.price || 0), currencySymbol)}</td></tr>`).join('')
        : '<tr><td colspan="5" class="muted">No line items recorded</td></tr>';
      const expenses = (invoice.expenseTotal || 0) > 0 ? `<section class="box"><label>EXPENSE DETAILS</label><div class="payment-row"><span>Baraf</span><strong>${money(invoice.expenses?.baraf || 0, currencySymbol)}</strong></div><div class="payment-row"><span>Rickshaw Rent</span><strong>${money(invoice.expenses?.rickshawRent || 0, currencySymbol)}</strong></div><div class="payment-row"><span>Worker Expense</span><strong>${money(invoice.expenses?.workerExpense || 0, currencySymbol)}</strong></div><div class="payment-row"><strong>Total expenses</strong><strong>${money(invoice.expenseTotal || 0, currencySymbol)}</strong></div></section>` : '';
      const rateHeading = invoice.invoiceType !== 'vendor' ? '<th class="num">Rate / kg</th>' : '';
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=112x112&data=${encodeURIComponent(`${window.location.origin}/invoice/${invoice.id}`)}`;
      return `<article class="invoice-page">
        <header class="invoice-header"><div class="brand-wrap"><img src="${template?.companyLogo || BRAND_MARK}" alt=""><div><div class="brand">${escapeHtml(template?.companyName || 'FINNOVA')}</div><div class="tagline">${escapeHtml(template?.tagline || 'Smart Finances, Better Business')}</div></div></div><div class="waves">≋</div></header>
        <section class="billed"><div><label>BILLED TO</label><strong>${escapeHtml(invoice.customerName)}</strong><span>${escapeHtml(invoice.customerEmail || invoice.customerPhone || '')}</span></div><div class="invoice-card"><div><label>INVOICE NO</label><strong>${escapeHtml(invoice.id)}</strong></div><div><label>DATE</label><strong>${escapeHtml(invoice.date || '—')}</strong></div></div></section>
        <div class="items-wrap"><table class="items"><thead><tr><th>Fish species</th><th>Description</th><th class="num">Quantity (kg)</th>${rateHeading}<th class="num">Amount</th></tr></thead><tbody>${items}</tbody></table></div>
        <div class="terms"><label>TERMS & CONDITIONS</label><div>${escapeHtml(template?.termsAndConditions || 'Payment is due within 30 days of invoice date.\nLate payments may incur additional charges.\nAll prices are in USD unless otherwise stated.').replace(/\n/g, '<br>')}</div></div>
        <div class="details">${invoice.notes ? `<section class="box"><label>PAYMENT INFORMATION</label><div>${escapeHtml(invoice.notes).replace(/\n/g, '<br>')}</div></section>` : ''}${expenses}</div>
        <div class="totals"><div><span>Gross amount</span><strong>${money(grossAmount, currencySymbol)}</strong></div><div><span>Commission ${invoice.taxRate ? `(${invoice.taxRate}%)` : ''}</span><strong>${money(invoice.taxAmount || 0, currencySymbol)}</strong></div><div><span>Expenses</span><strong>${money(invoice.expenseTotal || 0, currencySymbol)}</strong></div><div><span>Total amount</span><strong>${money(invoice.totalAmount, currencySymbol)}</strong></div><div><span>Amount paid</span><div class="paid-meta"><strong class="paid">${money(invoice.amountPaid, currencySymbol)}</strong>${paymentMarkup}</div></div><div class="balance ${invoice.balance > 0 ? 'due' : ''}"><span>${invoice.balance < 0 ? 'CHANGE DUE' : invoice.balance === 0 ? 'PAID IN FULL' : 'BALANCE DUE'}</span><strong>${money(Math.abs(invoice.balance), currencySymbol)}</strong></div></div>
        <section class="track"><div><label>TRACK ONLINE</label><p>Scan this QR code or visit the tracking page to check your invoice status anytime.</p></div><div class="qr"><img src="${qrUrl}" alt="QR code"><span>Scan to track<br>invoice status</span></div></section>
        <footer><span>☎ ${escapeHtml(template?.contactPhone || '123-456-7890')}</span><span>✉ ${escapeHtml(template?.contactEmail || 'billing@finnova.com')}</span><span>⌖ 123 Anywhere St., Any City</span></footer>
      </article>`;
    }).join('');
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(selectedContact?.fullName || 'Invoice history')}</title><meta charset="utf-8"><style>
      @page{size:A4;margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;background:#e9e8f0;color:#17152c;font-family:Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.invoice-page{width:210mm;min-height:297mm;margin:0 auto;padding:8mm 8.5mm 7mm;background:#fff;border-top:4px solid #131126;display:flex;flex-direction:column;page-break-after:always}.invoice-page:last-child{page-break-after:auto}.invoice-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #e7e5ef;padding:0 0 17px}.brand-wrap{display:flex;align-items:center;gap:12px}.brand-wrap img{width:42px;height:42px;object-fit:contain;border-radius:10px}.brand{font-size:22px;font-weight:800;letter-spacing:-.04em}.tagline{font-size:8px;color:#88849c;font-weight:700;letter-spacing:.1em;margin-top:5px;text-transform:uppercase}.waves{font-size:32px;line-height:1;color:#8c7be8;font-weight:800;transform:rotate(90deg);margin:8px 8px}.billed{display:flex;justify-content:space-between;align-items:center;padding:18px 0 15px}.billed label,.box label,.terms label,.track label{display:block;font-size:8px;color:#9692a8;font-weight:700;letter-spacing:.12em;margin-bottom:7px}.billed strong{display:block;font-size:16px}.billed span{display:block;font-size:10px;color:#77738a;margin-top:5px}.invoice-card{display:flex;background:#5a49e6;color:#fff;border-radius:16px;overflow:hidden;min-width:180px}.invoice-card>div{padding:12px 16px;text-align:center}.invoice-card>div+div{border-left:1px solid rgba(255,255,255,.2)}.invoice-card label{color:rgba(255,255,255,.65);font-size:7px}.invoice-card strong{font-size:11px;color:#fff}.items-wrap{background:#f6f5fb;border-radius:16px;overflow:hidden}.items{width:100%;border-collapse:collapse;font-size:10px}.items th{background:#f6f5fb;color:#77738a;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:.08em;padding:12px}.items td{background:#fff;border-top:4px solid #f6f5fb;padding:12px;font-size:10px}.num{text-align:right}.terms{font-size:9px;color:#77738a;line-height:1.55;margin-top:19px}.details{min-height:74px;margin-top:17px}.box{background:#f6f5fb;border-radius:14px;padding:13px;margin:0 0 10px;max-width:345px;font-size:9px;line-height:1.5}.payment-row{display:flex;justify-content:space-between;border-bottom:1px solid #e6e4ee;padding:4px 0}.totals{font-size:10px;margin-top:3px}.totals>div{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #eceaf2}.totals .paid-meta{display:flex;flex-direction:column;align-items:flex-end;text-align:right}.totals strong{font-size:13px}.totals small{font-size:8px;color:#9692a8;display:block;margin-top:3px}.totals .paid{color:#3f9c68}.totals .balance{background:#3f9c68;color:#fff;padding:13px 15px;border-radius:13px;margin-top:10px;border:0}.totals .balance.due{background:#c0453c}.totals .balance strong{color:#fff}.track{border-top:1px solid #e7e5ef;margin-top:18px;padding-top:16px;display:flex;justify-content:space-between;align-items:center;min-height:100px}.track p{font-size:9px;color:#77738a;line-height:1.5;max-width:280px;margin:0}.qr{display:flex;flex-direction:column;align-items:center;gap:5px}.qr img{width:86px;height:86px}.qr span{font-size:7px;color:#9692a8;text-align:center;line-height:1.3}footer{display:flex;justify-content:space-between;border-top:1px solid #e7e5ef;margin-top:13px;padding-top:12px;color:#77738a;font-size:8px}@media print{html,body{background:#fff!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.invoice-page{margin:0}.invoice-card,.items-wrap,.items th,.items td,.box,.totals .balance,.qr img{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
    </style></head><body>${pages}</body></html>`);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.focus(); printWindow.print(); };
  };

  const clearSelection = () => {
    setSelectedContact(null);
    setContactSearch('');
    setInvoices([]);
    setSearched(false);
  };

  const displayedTotals = !appliedFilters.status && !appliedFilters.fromMonth && !appliedFilters.toMonth && !appliedFilters.search && accountSummary
    ? accountSummary
    : totals;
  const summaryCards: Array<[string, string, string, LucideIcon]> = [
    ['Total billed', money(displayedTotals.billed, currencySymbol), 'bg-ink text-white', FileText],
    ['Total paid', money(displayedTotals.paid, currencySymbol), 'bg-mist text-ink', CheckCircle2],
    ['Outstanding', money(displayedTotals.outstanding, currencySymbol), 'bg-brand text-white', WalletCards],
    ['Settled invoices', String(displayedTotals.settled), 'bg-mist text-ink', CheckCircle2],
    ['Overdue', String(displayedTotals.overdue), 'bg-[#fff1ec] text-[#a8492f]', Clock3],
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
          <div className="relative"><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} aria-label="Filter history from date" title="From date" className="bg-mist hover:bg-mist-2 text-[12px] font-semibold text-ink pl-4 pr-10 py-2.5 rounded-full cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand min-w-[160px]" /><CalendarDays className="w-3.5 h-3.5 text-quill absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" /></div>
          <div className="relative"><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} aria-label="Filter history to date" title="To date" className="bg-mist hover:bg-mist-2 text-[12px] font-semibold text-ink pl-4 pr-10 py-2.5 rounded-full cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand min-w-[160px]" /><CalendarDays className="w-3.5 h-3.5 text-quill absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" /></div>
          <div className="relative flex-1 min-w-[160px] max-w-[260px]"><input type="text" value={invoiceQuery} onChange={(event) => setInvoiceQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') applyFilters(); }} placeholder="Enter invoice #" aria-label="Search account invoices" className="w-full bg-mist hover:bg-mist-2 focus:bg-mist-2 text-[12px] font-semibold text-ink placeholder:text-quill-soft pl-4 pr-10 py-2.5 rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" /><Search className="w-4 h-4 text-quill absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" /></div>
          <button type="button" onClick={applyFilters} className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-mid text-white text-[12px] font-bold px-4 py-2.5 rounded-full cursor-pointer"><Search className="w-3.5 h-3.5" /> Search</button>
          <button type="button" onClick={printHistory} disabled={filteredInvoices.length === 0} className="inline-flex items-center gap-1.5 bg-ink hover:bg-ink-2 disabled:opacity-40 disabled:pointer-events-none text-white text-[12px] font-bold px-4 py-2.5 rounded-full cursor-pointer"><Printer className="w-3.5 h-3.5" /> Print</button>
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
