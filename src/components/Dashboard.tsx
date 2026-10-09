import { useState, useEffect, useRef } from 'react';
import { AppUser } from '../lib/auth';
import { Invoice } from '../types';
import {
  getInvoicesPage,
  getNextInvoiceId,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  syncBookingToSheet
} from '../lib/invoices';
import {
  InvoiceTemplate,
  SpreadsheetSettings,
  getUserSettings,
  getTemplateWithDefaults,
  getSpreadsheetWithDefaults,
  getCurrencySymbol
} from '../lib/settings';
import { getTodayInTimezone } from '../lib/timezone';
import Charts from './Charts';
import InvoiceList from './InvoiceList';
import InvoiceForm from './InvoiceForm';
import Settings from './Settings';
import Ledger from './Ledger';
import KpiCards from './KpiCards';
import { DashboardSummary } from './KpiCards';
import { apiRequest } from '../lib/api';
import InvoiceShowcase from './InvoiceShowcase';
import Contacts from './Contacts';
import Payment from './Payment';
import UserHistory from './UserHistory';
import ExpenseTracker from './ExpenseTracker';
import { Contact, getContacts } from '../lib/contacts';
import {
  LogOut,
  RefreshCw,
  Plus,
  AlertCircle,
  Settings as SettingsIcon,
  Search,
  Bell,
  ArrowLeft,
  SlidersHorizontal,
  ChevronDown,
  FileText,
  Receipt,
  Wallet,
  ClipboardList,
  Repeat,
  ShoppingBag,
} from 'lucide-react';

const WORKSPACE_IMAGE =
  'https://mgx-backend-cdn.metadl.com/generate/images/1500378/2026-08-01/tumdfbacajrq/card-workspace-desk-plant-lamp.png';
const BRAND_MARK =
  'https://mgx-backend-cdn.metadl.com/generate/images/1500378/2026-08-01/tumdfoacajra/logo-finnova-n-mark.png';
const DASHBOARD_TIMEZONE = 'Asia/Karachi';

interface DashboardProps {
  user: AppUser;
  token: string;
  onLogout: () => Promise<void>;
  onTokenRefresh?: (newToken: string) => void;
}

type ViewState = 'dashboard' | 'vendor-dashboard' | 'create' | 'edit' | 'settings' | 'ledger' | 'payment' | 'contacts' | 'search' | 'expenses';

export default function Dashboard({ user, token, onLogout, onTokenRefresh }: DashboardProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [vendorInvoices, setVendorInvoices] = useState<Invoice[]>([]);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [vendorInvoiceTotal, setVendorInvoiceTotal] = useState(0);
  const [invoicePage, setInvoicePage] = useState(1);
  const [vendorInvoicePage, setVendorInvoicePage] = useState(1);
  const [hasMoreInvoices, setHasMoreInvoices] = useState(false);
  const [hasMoreVendorInvoices, setHasMoreVendorInvoices] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [currentToken, setCurrentToken] = useState(token);

  const [invoiceTemplate, setInvoiceTemplate] = useState<InvoiceTemplate | null>(null);
  const [spreadsheetSettings, setSpreadsheetSettings] = useState<SpreadsheetSettings | null>(null);

  const [viewState, setViewState] = useState<ViewState>(() => {
    try {
      const savedView = sessionStorage.getItem(`invoice-dashboard-view-${user.uid}`) as ViewState | null;
      const validViews: ViewState[] = ['dashboard', 'vendor-dashboard', 'create', 'edit', 'settings', 'ledger', 'payment', 'contacts', 'search', 'expenses'];
      return savedView && validViews.includes(savedView) ? savedView : 'dashboard';
    } catch {
      return 'dashboard';
    }
  });
  const [editingInvoice, setEditingInvoice] = useState<Invoice | undefined>(undefined);
  const [nextInvoiceId, setNextInvoiceId] = useState('');
  const [returnViewState, setReturnViewState] = useState<ViewState | null>(null);
  const [searchRefreshKey, setSearchRefreshKey] = useState(0);
  const [showcaseSelection, setShowcaseSelection] = useState<Invoice | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [vendorDashboardSummary, setVendorDashboardSummary] = useState<DashboardSummary | null>(null);

  // Filter strip state — drives the ledger + showcase below
  const [customerFilter, setCustomerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [vendorCustomerFilter, setVendorCustomerFilter] = useState('all');
  const [vendorStatusFilter, setVendorStatusFilter] = useState('all');
  const [vendorFromDate, setVendorFromDate] = useState('');
  const [vendorToDate, setVendorToDate] = useState('');
  const [vendorInvoiceQuery, setVendorInvoiceQuery] = useState('');
  const [appliedFilters, setAppliedFilters] = useState({
    customerId: '',
    status: '',
    fromDate: '',
    toDate: '',
    search: '',
  });
  const [appliedVendorFilters, setAppliedVendorFilters] = useState({
    customerId: '',
    status: '',
    fromDate: '',
    toDate: '',
    search: '',
  });

  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    actionLabel: string;
    actionStyle: string;
    onConfirm: () => void;
  } | null>(null);

  const postgresMigrationNote = 'PostgreSQL tables are created automatically by the Railway backend during startup. See backend/schema.sql.'
  const invoiceRequestRef = useRef(0);
  const summaryRequestRef = useRef(0);

  const handleCopySql = () => {
    navigator.clipboard.writeText(postgresMigrationNote);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  useEffect(() => {
    fetchInvoices();
    loadTemplateSettings();
    getContacts().then(setContacts).catch((err) => console.warn('Failed to load contacts:', err));
  }, []);

  useEffect(() => {
    fetchDashboardSummary();
  }, []);

  useEffect(() => {
    if (viewState !== 'create' || editingInvoice) return;
    getNextInvoiceId().then(setNextInvoiceId).catch((err) => console.warn('Could not load next invoice number:', err));
  }, [viewState, editingInvoice]);

  useEffect(() => {
    try {
      // Do not restore an edit screen after refresh because its selected invoice
      // is held in memory and cannot be reconstructed safely from view state alone.
      if (viewState === 'edit' || viewState === 'create') return;
      sessionStorage.setItem(`invoice-dashboard-view-${user.uid}`, viewState);
    } catch {
      // Session storage can be unavailable in privacy-restricted browsers.
    }
  }, [viewState, user.uid]);

  const fetchDashboardSummary = async () => {
    const requestId = ++summaryRequestRef.current;
    try {
      const date = getTodayInTimezone(DASHBOARD_TIMEZONE);
      const query = `date=${encodeURIComponent(date)}`;
      const [customerSummary, vendorSummary] = await Promise.all([
        apiRequest<DashboardSummary>(`/api/dashboard/summary?${query}&mode=customer`),
        apiRequest<DashboardSummary>(`/api/dashboard/summary?${query}&mode=vendor`),
      ]);
      if (requestId !== summaryRequestRef.current) return;
      setDashboardSummary(customerSummary);
      setVendorDashboardSummary(vendorSummary);
    } catch (err) {
      console.warn('Failed to load dashboard summary:', err);
    }
  };

  const loadTemplateSettings = async () => {
    try {
      const settings = await getUserSettings(user.uid);
      if (settings) {
        if (settings.invoice_template) {
          setInvoiceTemplate(getTemplateWithDefaults(settings.invoice_template));
        }
        if (settings.spreadsheet_settings) {
          setSpreadsheetSettings(getSpreadsheetWithDefaults(settings.spreadsheet_settings));
        }
      }
    } catch (err) {
      console.warn('Failed to load template settings:', err);
    }
  };

  const fetchInvoices = async (
    append = false,
    filters = appliedFilters,
    vendorFilters = appliedVendorFilters,
  ) => {
    if (append && loadingInvoices) return;
    const requestId = ++invoiceRequestRef.current;
    setLoadingInvoices(true);
    setError(null);
    try {
      const nextCustomerPage = append ? invoicePage + 1 : 1;
      const nextVendorPage = append ? vendorInvoicePage + 1 : 1;
      const customerPromise = getInvoicesPage({
        page: nextCustomerPage,
        limit: 2000,
        invoiceType: 'customer',
        customerId: filters.customerId || undefined,
        status: filters.status || undefined,
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
        search: filters.search || undefined,
      });
      const vendorPromise = getInvoicesPage({
          page: nextVendorPage,
          limit: 2000,
          invoiceType: 'vendor',
          customerId: vendorFilters.customerId || undefined,
          status: vendorFilters.status || undefined,
          fromDate: vendorFilters.fromDate || undefined,
          toDate: vendorFilters.toDate || undefined,
          search: vendorFilters.search || undefined,
        }).catch((vendorError) => {
          console.warn('Vendor invoices are unavailable:', vendorError);
          return { invoices: [] as Invoice[], total: 0, hasMore: false, page: nextVendorPage, limit: 2000 };
        });
      const [customerData, vendorData] = await Promise.all([customerPromise, vendorPromise]);
      if (requestId !== invoiceRequestRef.current) return;
      setInvoices((previous) => append ? [...previous, ...customerData.invoices] : customerData.invoices);
      setVendorInvoices((previous) => append ? [...previous, ...vendorData.invoices] : vendorData.invoices);
      setInvoicePage(nextCustomerPage);
      setVendorInvoicePage(nextVendorPage);
      setInvoiceTotal(customerData.total);
      setVendorInvoiceTotal(vendorData.total);
      setHasMoreInvoices(customerData.hasMore);
      setHasMoreVendorInvoices(vendorData.hasMore);
      // Loading another invoice page must not refresh the dashboard summaries.
      // Summary data is refreshed on the initial load and after mutations only.
      if (!append) await fetchDashboardSummary();
    } catch (err: any) {
      setError(err.message || 'Failed to load invoices from Supabase.');
    } finally {
      if (requestId === invoiceRequestRef.current) setLoadingInvoices(false);
    }
  };

  const handleSaveInvoice = async (
    invoiceData: Omit<Invoice, 'rowIndex' | 'rawRow'> & { rowIndex?: number }
  ) => {
    const performSave = async () => {
      setLoadingInvoices(true);
      setError(null);
      try {
        if (viewState === 'edit' && editingInvoice) {
          await updateInvoice(editingInvoice.id, invoiceData);
        } else {
          await createInvoice(invoiceData);
        }

        if (spreadsheetSettings?.spreadsheetId && spreadsheetSettings?.sheetName && token) {
          try {
            await syncBookingToSheet(
              invoiceData.id,
              invoiceData.customerName,
              invoiceData.items.map((item) => ({
                checkIn: item.checkIn,
                checkOut: item.checkOut,
                nights: item.nights,
                quantity: item.quantity,
                roomType: item.roomType,
              })),
              spreadsheetSettings.spreadsheetId,
              spreadsheetSettings.sheetName,
              token
            );
          } catch (sheetErr: any) {
            console.error('Failed to sync booking to Google Sheets:', sheetErr);
            setError(`Invoice saved to database, but failed to sync to Google Sheets: ${sheetErr.message}`);
          }
        }

        await fetchInvoices();
        const savedInvoice = invoiceData as Invoice;
        if (savedInvoice.invoiceType === 'vendor') {
          setVendorInvoices((previous) => {
            const existing = previous.find((invoice) => invoice.id === savedInvoice.id);
            return [existing || savedInvoice, ...previous.filter((invoice) => invoice.id !== savedInvoice.id)];
          });
        } else {
          setInvoices((previous) => {
            const existing = previous.find((invoice) => invoice.id === savedInvoice.id);
            return [existing || savedInvoice, ...previous.filter((invoice) => invoice.id !== savedInvoice.id)];
          });
        }
        const destination = returnViewState || (invoiceData.invoiceType === 'vendor' ? 'vendor-dashboard' : 'dashboard');
        setViewState(destination);
        if (destination === 'search') setSearchRefreshKey((key) => key + 1);
        setReturnViewState(null);
        setEditingInvoice(undefined);
        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      } catch (err: any) {
        setError(`Failed to save invoice: ${err.message}`);
      } finally {
        setLoadingInvoices(false);
      }
    };

    if (viewState === 'edit' && editingInvoice) {
      setConfirmModal({
        title: 'Save changes to this invoice?',
        message: `Invoice #${invoiceData.id} will be updated in Supabase and synchronized with Google Sheets.`,
        actionLabel: 'Update invoice',
        actionStyle: 'bg-brand hover:bg-brand-mid',
        onConfirm: () => {
          performSave();
          setConfirmModal(null);
        }
      });
    } else {
      performSave();
    }
  };

  const handleMarkAsPaid = async (invoice: Invoice) => {
    const performMark = async () => {
      const todayStr = getTodayInTimezone(invoiceTemplate?.timezone || 'Asia/Karachi');
      const updatedInvoice: Omit<Invoice, 'rowIndex' | 'rawRow'> = {
        id: invoice.id,
        date: invoice.date,
        customerName: invoice.customerName,
        customerId: invoice.customerId,
        customerEmail: invoice.customerEmail,
        customerPhone: invoice.customerPhone,
        totalAmount: invoice.totalAmount,
        taxRate: invoice.taxRate || 0,
        taxAmount: invoice.taxAmount || 0,
        expenses: invoice.expenses || { baraf: 0, rickshawRent: 0, workerExpense: 0 },
        expenseTotal: invoice.expenseTotal || 0,
        amountPaid: invoice.totalAmount,
        paymentDate: todayStr,
        balance: 0,
        status: 'Paid',
        notes: invoice.notes,
        items: invoice.items,
        payments: [{ amount: invoice.totalAmount, date: todayStr }]
        ,invoiceType: invoice.invoiceType || 'customer'
      };

      setLoadingInvoices(true);
      try {
        await updateInvoice(invoice.id, updatedInvoice);

        if (spreadsheetSettings?.spreadsheetId && spreadsheetSettings?.sheetName && token) {
          try {
            await syncBookingToSheet(
              invoice.id,
              invoice.customerName,
              invoice.items.map((item) => ({
                checkIn: item.checkIn,
                checkOut: item.checkOut,
                nights: item.nights,
                quantity: item.quantity,
                roomType: item.roomType,
              })),
              spreadsheetSettings.spreadsheetId,
              spreadsheetSettings.sheetName,
              token
            );
          } catch (sheetErr: any) {
            console.error('Failed to sync booking to Google Sheets:', sheetErr);
            setError(`Invoice updated, but failed to sync to Google Sheets: ${sheetErr.message}`);
          }
        }

        setShowcaseSelection(null);
        await fetchInvoices();
      } catch (err: any) {
        setError(`Failed to mark invoice as paid: ${err.message}`);
      } finally {
        setLoadingInvoices(false);
      }
    };

    setConfirmModal({
      title: 'Settle this invoice in full?',
      message: `Invoice #${invoice.id} will be marked Paid and the full amount recorded as collected today.`,
      actionLabel: 'Settle invoice',
      actionStyle: 'bg-[#3f9c68] hover:bg-[#35855a]',
      onConfirm: () => {
        performMark();
        setConfirmModal(null);
      }
    });
  };

  const handleApplyPayment = async (contactId: string, amount: number): Promise<number> => {
    const paymentDate = getTodayInTimezone(invoiceTemplate?.timezone || 'Asia/Karachi');
    setLoadingInvoices(true);
    setError(null);
    try {
      const result = await apiRequest<{ allocated: number }>('/api/payments', {
        method: 'POST',
        body: JSON.stringify({ contactId, amount, paymentDate, paymentId: crypto.randomUUID() }),
      });
      await fetchInvoices();
      await fetchDashboardSummary();
      return result.allocated;
    } catch (err: any) {
      throw new Error(`Payment saved only partially or failed: ${err.message}`);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    const performDelete = async () => {
      setLoadingInvoices(true);
      try {
        await deleteInvoice(invoice.id, invoice.invoiceType || 'customer');
        setShowcaseSelection(null);
        await fetchInvoices();
        if (viewState === 'search') setSearchRefreshKey((key) => key + 1);
      } catch (err: any) {
        setError(`Failed to delete invoice: ${err.message}`);
      } finally {
        setLoadingInvoices(false);
      }
    };

    setConfirmModal({
      title: 'Delete this invoice?',
      message: `Invoice #${invoice.id} will be permanently removed from your database. This cannot be undone.`,
      actionLabel: 'Delete invoice',
      actionStyle: 'bg-[#d9534a] hover:bg-[#c0453c]',
      onConfirm: () => {
        performDelete();
        setConfirmModal(null);
      }
    });
  };

  const currencySymbol = getCurrencySymbol(invoiceTemplate?.currency || 'USD');

  // Derived filter data
  const customers = contacts
    .filter((contact) => contact.type === 'customer')
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
  const vendorCustomers = contacts
    .filter((contact) => contact.type === 'vendor')
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  // The API returns the filtered page, so totals and pagination represent all matches.
  const filteredInvoices = invoices;

  const activeFilterCount =
    (customerFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (fromDate ? 1 : 0) +
    (toDate ? 1 : 0) +
    (invoiceQuery.trim() ? 1 : 0);
  const activeVendorFilterCount =
    (vendorCustomerFilter !== 'all' ? 1 : 0) +
    (vendorStatusFilter !== 'all' ? 1 : 0) +
    (vendorFromDate ? 1 : 0) +
    (vendorToDate ? 1 : 0) +
    (vendorInvoiceQuery.trim() ? 1 : 0);

  const resetFilters = () => {
    setCustomerFilter('all');
    setStatusFilter('all');
    setFromDate('');
    setToDate('');
    setInvoiceQuery('');
    const nextFilters = { customerId: '', status: '', fromDate: '', toDate: '', search: '' };
    setVendorCustomerFilter('all');
    setVendorStatusFilter('all');
    setVendorFromMonth('');
    setVendorToMonth('');
    setVendorInvoiceQuery('');
    const nextVendorFilters = { customerId: '', status: '', fromDate: '', toDate: '', search: '' };
    setAppliedFilters(nextFilters);
    setAppliedVendorFilters(nextVendorFilters);
    fetchInvoices(false, nextFilters, nextVendorFilters);
  };

  const applyFilters = () => {
    const nextFilters = {
      customerId: customerFilter === 'all' ? '' : customerFilter,
      status: statusFilter === 'all' ? '' : statusFilter,
      fromDate,
      toDate,
      search: invoiceQuery.trim(),
    };
    setAppliedFilters(nextFilters);
    fetchInvoices(false, nextFilters, appliedVendorFilters);
  };

  const applyVendorFilters = () => {
    const nextFilters = {
      customerId: vendorCustomerFilter === 'all' ? '' : vendorCustomerFilter,
      status: vendorStatusFilter === 'all' ? '' : vendorStatusFilter,
      fromDate: vendorFromDate,
      toDate: vendorToDate,
      search: vendorInvoiceQuery.trim(),
    };
    setAppliedVendorFilters(nextFilters);
    fetchInvoices(false, appliedFilters, nextFilters);
  };

  const overdueCount = invoices.filter((inv) => inv.status === 'Overdue' || (inv.balance > 0 && new Date(inv.date).getTime() < Date.now())).length;

  const userInitials = user.displayName
    ? user.displayName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user.email?.slice(0, 2).toUpperCase() || 'U';

  const navItems: { key: ViewState; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'vendor-dashboard', label: 'Vendor dashboard' },
    { key: 'create', label: 'Invoice' },
    { key: 'ledger', label: 'Ledger' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'payment', label: 'Payment' },
    { key: 'contacts', label: 'Contacts' },
    { key: 'search', label: 'Search' },
    { key: 'settings', label: 'Settings' },
  ];



  const pageTitle =
    viewState === 'dashboard'
      ? 'Customer invoices'
      : viewState === 'vendor-dashboard'
        ? 'Vendor dashboard'
      : viewState === 'create'
        ? 'New invoice'
        : viewState === 'edit'
          ? 'Edit invoice'
            : viewState === 'ledger'
              ? 'Ledger'
              : viewState === 'payment'
                ? 'Payment'
              : viewState === 'contacts'
                ? 'Contacts'
              : viewState === 'search'
                ? 'Search history'
              : viewState === 'expenses'
                ? 'Expense tracker'
              : 'Settings';

  const pageSubtitle =
    viewState === 'dashboard'
      ? 'Manage customer sales, collections and fishery billing in one place.'
      : viewState === 'vendor-dashboard'
        ? 'Track vendor purchases, fish species, quantities and amounts payable.'
      : viewState === 'create'
        ? 'Draft a new invoice and send it for collection.'
        : viewState === 'edit'
          ? 'Adjust line items, totals and payment records.'
            : viewState === 'ledger'
              ? 'Every payment movement, reconciled by date.'
              : viewState === 'payment'
                ? 'Record payments and allocate them from the oldest invoice to the newest.'
              : viewState === 'contacts'
                ? 'Manage the vendors and customers connected to your ledger.'
              : viewState === 'search'
                ? 'Search any customer or vendor’s complete invoice history.'
              : viewState === 'expenses'
                ? 'Track Baraf, Rickshaw Rent and Worker Expense across vendor invoices.'
              : 'Company profile, currency and sheet connection.';

  return (
    <div className="min-h-screen bg-canvas px-3 sm:px-5 py-4 sm:py-6" id="dashboard-root">
      <div className="max-w-[1320px] mx-auto bg-shell rounded-[34px] px-4 sm:px-7 py-5 sm:py-6 shadow-[0_40px_90px_-60px_rgba(19,17,38,0.7)]">
        {/* ── Top bar ─────────────────────────────────────────── */}
        <header className="flex items-center justify-between gap-4" id="global-navbar">
          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <img src={BRAND_MARK} alt="" className="w-9 h-9 object-contain" />
            <div className="hidden sm:block leading-none">
              <span className="block text-[19px] font-extrabold tracking-tight text-ink font-display">
                {invoiceTemplate?.companyName || 'FINNOVA'}
              </span>
              <span className="block text-[9px] font-semibold text-quill-soft mt-1">
                Smart Finances, Better Business
              </span>
            </div>
          </div>

          {/* Dark pill nav */}
          <div className="flex items-center gap-3 flex-1 justify-center min-w-0">
            <span className="nums hidden xl:flex w-11 h-11 rounded-full bg-mist items-center justify-center text-[13px] font-bold text-ink shrink-0">
              {invoices.length}
            </span>

            <nav className="flex items-center gap-1 bg-ink rounded-full p-1.5 overflow-x-auto no-scrollbar max-w-full">
              {navItems.map((item) => {
                const active =
                  viewState === item.key ||
                  (item.key === 'create' && viewState === 'edit');
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      if (item.key === 'create') setEditingInvoice(undefined);
                      setViewState(item.key);
                    }}
                    className={`px-4 py-2.5 rounded-full text-[12px] font-bold whitespace-nowrap transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-soft ${
                      active ? 'bg-brand text-white' : 'text-white/60 hover:md:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Icon cluster */}
          <div className="flex items-center gap-1.5 shrink-0">


            <button
              type="button"
              onClick={() => fetchInvoices()}
              disabled={loadingInvoices}
              title="Sync database"
              className="w-10 h-10 rounded-full bg-mist hover:bg-mist-2 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <RefreshCw className={`w-4 h-4 text-ink ${loadingInvoices ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              title="Overdue alerts"
              onClick={() => setStatusFilter('Overdue')}
              className="w-10 h-10 rounded-full bg-mist hover:bg-mist-2 flex items-center justify-center transition-colors duration-200 cursor-pointer relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <Bell className="w-4 h-4 text-ink" />
              {overdueCount > 0 && (
                <span className="nums absolute top-1.5 right-1.5 min-w-[15px] h-[15px] px-1 bg-[#e4694a] rounded-full text-[8px] text-white font-bold flex items-center justify-center">
                  {overdueCount}
                </span>
              )}
            </button>

            <button
              type="button"
              title="Settings"
              onClick={() => setViewState('settings')}
              className="w-10 h-10 rounded-full bg-mist hover:bg-mist-2 flex items-center justify-center transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <SettingsIcon className="w-4 h-4 text-ink" />
            </button>

            <div className="flex items-center gap-1.5 ml-0.5">
              <div className="w-10 h-10 rounded-full bg-brand-soft flex items-center justify-center text-white text-[12px] font-bold overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  userInitials
                )}
              </div>
              <button
                type="button"
                onClick={onLogout}
                title="Sign out"
                className="w-9 h-9 rounded-full hover:bg-mist flex items-center justify-center transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <LogOut className="w-4 h-4 text-quill" />
              </button>
            </div>
          </div>
        </header>

        {/* ── Page heading ────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4 mt-7 mb-6">
          <div className="flex items-start gap-3.5">
            {viewState !== 'dashboard' && (
              <button
                type="button"
                onClick={() => {
                  setViewState('dashboard');
                  setEditingInvoice(undefined);
                }}
                title="Back to invoices"
                className="w-11 h-11 rounded-full bg-mist hover:bg-mist-2 flex items-center justify-center transition-colors duration-200 cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <ArrowLeft className="w-5 h-5 text-ink" />
              </button>
            )}
            <div>
              <h1 className="text-[34px] sm:text-[40px] leading-none font-extrabold tracking-tight text-ink font-display">
                {pageTitle}
              </h1>
              <p className="text-[12px] text-quill-soft font-medium mt-2">{pageSubtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={resetFilters}
              title="Reset filters"
              className="w-11 h-11 rounded-full bg-mist hover:bg-mist-2 flex items-center justify-center transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <SlidersHorizontal className="w-4 h-4 text-ink" />
            </button>
            {viewState !== 'contacts' && (
            <button
              type="button"
              onClick={() => {
                setEditingInvoice(undefined);
                setViewState('create');
              }}
              className="flex items-center gap-2 bg-brand hover:bg-brand-mid text-white text-[13px] font-bold pl-5 pr-6 py-3.5 rounded-full transition-colors duration-200 cursor-pointer shadow-[0_18px_34px_-20px_rgba(90,73,230,0.95)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <Plus className="w-4 h-4" /> Create an invoice
            </button>
            )}
          </div>
        </div>

        {/* ── Error / setup notice ────────────────────────────── */}
        {error && (
          <div className="space-y-5 mb-7 animate-fade-in">
            <div className="bg-[#fdf0ec] text-[#a8492f] p-5 rounded-[22px] text-[13px] font-semibold flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">We couldn't reach your database</p>
                <p className="text-[12px] text-[#b5654c] mt-1 font-medium">{error}</p>
              </div>
            </div>

            <div className="bg-mist p-6 sm:p-7 rounded-[26px] space-y-5">
              <div className="flex flex-wrap justify-between items-start gap-4">
                <div>
                  <h3 className="text-[16px] font-extrabold text-ink font-display">Database setup required</h3>
                  <p className="text-[12px] text-quill mt-1.5 leading-relaxed max-w-xl font-medium">
                    Create the{' '}
                    <code className="bg-shell px-1.5 py-0.5 rounded-md font-mono text-[11px] text-brand">invoices</code>{' '}
                    table in your Supabase project by running this SQL.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="bg-brand hover:bg-brand-mid text-white text-[12px] font-bold px-4 py-2.5 rounded-full transition-colors duration-200 cursor-pointer"
                >
                  {copiedSql ? 'Copied' : 'Copy migration note'}
                </button>
              </div>
              <pre className="bg-ink text-white/85 p-5 rounded-[20px] font-mono text-[11px] overflow-x-auto leading-relaxed max-h-56 ink-scroll">
                {postgresMigrationNote}
              </pre>
            </div>
          </div>
        )}

        {/* ── Dashboard view ─────────────────────────────────── */}
        {viewState === 'dashboard' && (
          <div className="space-y-6" id="main-dashboard-panels">
            <KpiCards
              invoices={invoices}
              summary={dashboardSummary}
              currencySymbol={currencySymbol}
              workspaceImage={WORKSPACE_IMAGE}
              onOpenLedger={() => setViewState('ledger')}
              template={invoiceTemplate}
              onCreateInvoice={() => {
                setEditingInvoice(undefined);
                setViewState('create');
              }}
              onSync={fetchInvoices}
              loadingSync={loadingInvoices}
            />

            {/* Filter strip */}
            <div className="flex flex-wrap items-center gap-2.5 py-1" id="filter-strip">
              <div className="flex items-center gap-2 mr-1">
                <span className="text-[12px] font-bold text-ink">Active filters</span>
                <span className="nums w-6 h-6 rounded-full bg-mist-2 text-ink text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              </div>

              <div className="relative">
                <select
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  aria-label="Filter by customer"
                  className="select-bare bg-mist hover:bg-mist-2 text-[12px] font-semibold text-ink pl-4 pr-9 py-3 rounded-full cursor-pointer transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand min-w-[150px]"
                >
                  <option value="all">All customers</option>
                  {customers.map((contact) => (
                    <option key={contact.id} value={contact.id}>{contact.fullName}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-quill absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter by status"
                  className="select-bare bg-mist hover:bg-mist-2 text-[12px] font-semibold text-ink pl-4 pr-9 py-3 rounded-full cursor-pointer transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand min-w-[135px]"
                >
                  <option value="all">All statuses</option>
                  {['Paid', 'Due', 'Unpaid', 'Pending', 'Overdue'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-quill absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <label className="relative flex items-center gap-2 bg-mist hover:bg-mist-2 rounded-full px-4 py-2.5 text-[12px] font-semibold text-ink"><span className="text-quill">From</span><input type="date" value={fromDate} max={toDate || undefined} onChange={(e) => setFromDate(e.target.value)} aria-label="From date" className="bg-transparent outline-none cursor-pointer" /></label>

              <label className="relative flex items-center gap-2 bg-mist hover:bg-mist-2 rounded-full px-4 py-2.5 text-[12px] font-semibold text-ink"><span className="text-quill">To</span><input type="date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} aria-label="To date" className="bg-transparent outline-none cursor-pointer" /></label>

              <div className="relative flex-1 min-w-[160px] max-w-[260px]">
                <input
                  type="text"
                  value={invoiceQuery}
                  onChange={(e) => setInvoiceQuery(e.target.value)}
                  placeholder="Enter invoice #"
                  aria-label="Search invoices"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') applyFilters();
                  }}
                  className="w-full bg-mist hover:bg-mist-2 focus:bg-mist-2 text-[12px] font-semibold text-ink placeholder:text-quill-soft placeholder:font-medium pl-4 pr-10 py-2.5 rounded-full outline-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                />
                <Search className="w-4 h-4 text-quill absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <button
                type="button"
                onClick={applyFilters}
                disabled={loadingInvoices}
                className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-mid disabled:opacity-60 disabled:pointer-events-none text-white text-[12px] font-bold px-4 py-2.5 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Search className="w-3.5 h-3.5" /> Search
              </button>
            </div>

            {/* Dark showcase panel */}
            <InvoiceShowcase
              invoices={filteredInvoices}
              currencySymbol={currencySymbol}
              companyName={invoiceTemplate?.companyName || 'FINNOVA'}
              selected={showcaseSelection}
              onSelect={setShowcaseSelection}
              onEdit={(inv) => {
                setEditingInvoice(inv);
                setViewState('edit');
              }}
              onMarkAsPaid={handleMarkAsPaid}
            />

            {/* Analytics */}
            <section className="bg-shell rounded-[26px] p-6 sm:p-7 shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)]">
              <div className="flex flex-wrap justify-between items-end gap-3 mb-6">
                <div>
                  <h2 className="text-[19px] font-extrabold text-ink font-display tracking-tight">Analytics</h2>
                  <p className="text-[12px] text-quill-soft font-medium mt-1">
                    Revenue trend, status split and your strongest accounts.
                  </p>
                </div>
                <span className="nums text-[11px] font-bold text-quill bg-mist px-3.5 py-2 rounded-full">
                  {invoices.length} invoice{invoices.length === 1 ? '' : 's'} tracked
                </span>
              </div>
              <Charts invoices={invoices} currencyCode={invoiceTemplate?.currency || 'USD'} currencySymbol={currencySymbol} />
            </section>

            {/* Full ledger table */}
            <section className="bg-shell rounded-[26px] p-6 sm:p-7 shadow-[0_18px_40px_-32px_rgba(19,17,38,0.5)]">
              <div className="flex flex-wrap justify-between items-end gap-3 mb-6">
                <div>
                  <h2 className="text-[19px] font-extrabold text-ink font-display tracking-tight">Invoice ledger</h2>
                  <p className="text-[12px] text-quill-soft font-medium mt-1">
                    Every invoice, searchable and printable.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingInvoice(undefined);
                    setViewState('create');
                  }}
                  className="flex items-center gap-2 bg-mist hover:bg-mist-2 text-ink text-[12px] font-bold px-4 py-2.5 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <Plus className="w-3.5 h-3.5" /> Add invoice
                </button>
              </div>
              <InvoiceList
                invoices={filteredInvoices}
                total={invoiceTotal}
                hasMore={hasMoreInvoices}
                onLoadMore={() => fetchInvoices(true)}
                onEdit={(inv) => {
                  setEditingInvoice(inv);
                  setViewState('edit');
                }}
                onDelete={handleDeleteInvoice}
                onMarkAsPaid={handleMarkAsPaid}
                template={invoiceTemplate}
              />
            </section>
          </div>
        )}

        {viewState === 'vendor-dashboard' && (
          <div className="space-y-6 animate-fade-in" id="vendor-dashboard-panels">
            <KpiCards mode="vendor" invoices={vendorInvoices} summary={vendorDashboardSummary} currencySymbol={currencySymbol} workspaceImage={WORKSPACE_IMAGE} onOpenLedger={() => setViewState('ledger')} template={invoiceTemplate} onCreateInvoice={() => { setEditingInvoice(undefined); setViewState('create'); }} onSync={fetchInvoices} loadingSync={loadingInvoices} />
            <div className="flex flex-wrap items-center gap-2.5 py-1" id="vendor-filter-strip">
              <div className="flex items-center gap-2 mr-1">
                <span className="text-[12px] font-bold text-ink">Active filters</span>
                <span className="nums w-6 h-6 rounded-full bg-mist-2 text-ink text-[10px] font-bold flex items-center justify-center">{activeVendorFilterCount}</span>
              </div>
              <div className="relative">
                <select value={vendorCustomerFilter} onChange={(e) => setVendorCustomerFilter(e.target.value)} aria-label="Filter vendor invoices by vendor" className="select-bare bg-mist hover:bg-mist-2 text-[12px] font-semibold text-ink pl-4 pr-9 py-3 rounded-full cursor-pointer transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand min-w-[150px]">
                  <option value="all">All vendors</option>
                  {vendorCustomers.map((contact) => <option key={contact.id} value={contact.id}>{contact.fullName}</option>)}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-quill absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <div className="relative">
                <select value={vendorStatusFilter} onChange={(e) => setVendorStatusFilter(e.target.value)} aria-label="Filter vendor invoices by status" className="select-bare bg-mist hover:bg-mist-2 text-[12px] font-semibold text-ink pl-4 pr-9 py-3 rounded-full cursor-pointer transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand min-w-[135px]">
                  <option value="all">All statuses</option>
                  {['Paid', 'Due', 'Unpaid', 'Pending', 'Overdue'].map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-quill absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <label className="relative flex items-center gap-2 bg-mist hover:bg-mist-2 rounded-full px-4 py-2.5 text-[12px] font-semibold text-ink"><span className="text-quill">From</span><input type="date" value={vendorFromDate} max={vendorToDate || undefined} onChange={(e) => setVendorFromDate(e.target.value)} aria-label="From vendor date" className="bg-transparent outline-none cursor-pointer" /></label>
              <label className="relative flex items-center gap-2 bg-mist hover:bg-mist-2 rounded-full px-4 py-2.5 text-[12px] font-semibold text-ink"><span className="text-quill">To</span><input type="date" value={vendorToDate} min={vendorFromDate || undefined} onChange={(e) => setVendorToDate(e.target.value)} aria-label="To vendor date" className="bg-transparent outline-none cursor-pointer" /></label>
              <div className="relative flex-1 min-w-[160px] max-w-[260px]">
                <input type="text" value={vendorInvoiceQuery} onChange={(e) => setVendorInvoiceQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyVendorFilters(); }} placeholder="Enter invoice #" aria-label="Search vendor invoices" className="w-full bg-mist hover:bg-mist-2 focus:bg-mist-2 text-[12px] font-semibold text-ink placeholder:text-quill-soft placeholder:font-medium pl-4 pr-10 py-2.5 rounded-full outline-none transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" />
                <Search className="w-4 h-4 text-quill absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <button type="button" onClick={applyVendorFilters} disabled={loadingInvoices} className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-mid disabled:opacity-60 disabled:pointer-events-none text-white text-[12px] font-bold px-4 py-2.5 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                <Search className="w-3.5 h-3.5" /> Search
              </button>
            </div>
            <InvoiceList invoices={vendorInvoices} total={vendorInvoiceTotal} hasMore={hasMoreVendorInvoices} onLoadMore={() => fetchInvoices(true)} onEdit={(invoice) => { setEditingInvoice(invoice); setViewState('edit'); }} onDelete={handleDeleteInvoice} onMarkAsPaid={handleMarkAsPaid} template={invoiceTemplate} />
          </div>
        )}

        {/* ── Create / Edit ──────────────────────────────────── */}
        {(viewState === 'create' || viewState === 'edit') && (
          <div className="animate-fade-in" id="invoice-editor-section">
      <InvoiceForm
              invoice={editingInvoice}
              contacts={contacts}
              suggestInvoiceId={
                viewState === 'create' ? (nextInvoiceId || undefined) : undefined
              }
              onSave={handleSaveInvoice}
              onCancel={() => {
                setViewState('dashboard');
                setEditingInvoice(undefined);
              }}
              template={invoiceTemplate}
            />
          </div>
        )}

        {/* ── Ledger ────────────────────────────────────────── */}
        {viewState === 'ledger' && (
          <div className="animate-fade-in">
            <Ledger template={invoiceTemplate} />
          </div>
        )}

        {/* ── Payments ───────────────────────────────────────── */}
        {viewState === 'payment' && (
          <div className="animate-fade-in" id="payment-section">
            <Payment
              invoices={invoices}
              vendorInvoices={vendorInvoices}
              contacts={contacts}
              template={invoiceTemplate}
              onSavePayment={handleApplyPayment}
            />
          </div>
        )}

        {/* ── Contacts ────────────────────────────────────────── */}
        {viewState === 'contacts' && (
          <div className="animate-fade-in" id="contacts-section">
            <Contacts />
          </div>
        )}

        {viewState === 'search' && (
          <UserHistory
            key={searchRefreshKey}
            contacts={contacts}
            template={invoiceTemplate}
            onEdit={(invoice) => {
              setEditingInvoice(invoice);
              setReturnViewState('search');
              setViewState('edit');
            }}
            onDelete={handleDeleteInvoice}
            onMarkAsPaid={handleMarkAsPaid}
          />
        )}

        {viewState === 'expenses' && <ExpenseTracker template={invoiceTemplate} />}

        {/* ── Settings ──────────────────────────────────────── */}
        {viewState === 'settings' && (
          <div className="animate-fade-in" id="settings-section">
            <Settings
              user={user}
              token={currentToken}
              onClose={() => setViewState('dashboard')}
              onSettingsSaved={(newToken?: string) => {
                if (newToken) {
                  setCurrentToken(newToken);
                  if (onTokenRefresh) onTokenRefresh(newToken);
                }
                loadTemplateSettings();
              }}
            />
          </div>
        )}

        {/* Footer strip */}
        <footer className="mt-8 pt-5 border-t border-hairline flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] font-semibold text-quill-soft">
            {invoiceTemplate?.companyName || 'FINNOVA'} · Smart Finances, Better Business
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-quill-soft">
            <ShoppingBag className="w-3.5 h-3.5" /> Synced with Supabase
          </span>
        </footer>
      </div>

      {/* ── Confirmation dialog ─────────────────────────────── */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/45 animate-fade-in"
          id="custom-confirm-dialog"
        >
          <div className="bg-shell rounded-[26px] max-w-md w-full p-7 space-y-5 shadow-[0_40px_80px_-40px_rgba(19,17,38,0.8)]">
            <div className="space-y-2">
              <h3 className="text-[18px] font-extrabold text-ink font-display tracking-tight">
                {confirmModal.title}
              </h3>
              <p className="text-[13px] text-quill leading-relaxed font-medium">{confirmModal.message}</p>
            </div>
            <div className="flex gap-2.5 justify-end pt-1">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-5 py-3 bg-mist hover:bg-mist-2 text-ink rounded-full text-[12px] font-bold transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Keep as is
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`px-5 py-3 text-white rounded-full text-[12px] font-bold transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${confirmModal.actionStyle}`}
              >
                {confirmModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
