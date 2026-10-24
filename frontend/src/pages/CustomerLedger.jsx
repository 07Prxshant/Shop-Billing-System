import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { formatCurrency, round2 } from '../utils/money';
import { formatDate, toInputDateFormat } from '../utils/date';
import AddPaymentModal from '../components/AddPaymentModal';
import {
  BookOpen,
  ArrowLeft,
  User,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  Plus,
  FileDown,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle
} from 'lucide-react';

export default function CustomerLedger() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [summary, setSummary] = useState({ total_billed: 0, total_paid: 0, total_pending: 0 });
  const [transactions, setTransactions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // View state: 'daily' | 'monthly'
  const [viewMode, setViewMode] = useState('daily');
  // Tab state: 'bills' | 'payments'
  const [activeTab, setActiveTab] = useState('bills');

  // Period filter: presets 'today' | 'this_month' | 'last_month' | 'all' | 'custom'
  const [periodPreset, setPeriodPreset] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modals
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', address: '' });

  // Inline edit of amount paid
  const [inlineEditBillId, setInlineEditBillId] = useState(null);
  const [inlineEditPaidValue, setInlineEditPaidValue] = useState('');
  const [inlineError, setInlineError] = useState('');

  // Apply period presets
  const handlePeriodPreset = (preset) => {
    setPeriodPreset(preset);
    const today = new Date();

    if (preset === 'today') {
      const d = toInputDateFormat(today);
      setFromDate(d);
      setToDate(d);
    } else if (preset === 'this_month') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      setFromDate(toInputDateFormat(first));
      setToDate(toInputDateFormat(last));
    } else if (preset === 'last_month') {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      setFromDate(toInputDateFormat(first));
      setToDate(toInputDateFormat(last));
    } else if (preset === 'all') {
      setFromDate('');
      setToDate('');
    }
  };

  const loadLedgerData = async () => {
    try {
      setLoading(true);
      const params = {
        from: fromDate || undefined,
        to: toDate || undefined,
        view: viewMode
      };

      const [custRes, sumRes, transRes, payRes] = await Promise.all([
        api.get(`/customers/${id}`),
        api.get(`/customers/${id}/summary`, { params }),
        api.get(`/customers/${id}/transactions`, { params }),
        api.get(`/payments`, { params: { customerId: id } })
      ]);

      if (custRes.data.success) {
        setCustomer(custRes.data.data);
        setProfileForm({
          name: custRes.data.data.name,
          phone: custRes.data.data.phone || '',
          address: custRes.data.data.address || ''
        });
      }
      if (sumRes.data.success) setSummary(sumRes.data.data);
      if (transRes.data.success) setTransactions(transRes.data.data);
      if (payRes.data.success) setPayments(payRes.data.data);
    } catch (err) {
      console.error('Failed to load ledger data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedgerData();
  }, [id, fromDate, toDate, viewMode]);

  // Save profile changes
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/customers/${id}`, profileForm);
      if (res.data.success) {
        setCustomer(res.data.data);
        setEditProfileOpen(false);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update profile');
    }
  };

  // Inline edit amount paid on a bill
  const handleSaveInlinePaid = async (bill) => {
    setInlineError('');
    const newPaid = parseFloat(inlineEditPaidValue);
    if (isNaN(newPaid) || newPaid < 0) {
      setInlineError('Amount cannot be negative');
      return;
    }
    if (newPaid > Number(bill.total_amount)) {
      setInlineError(`Paid amount cannot exceed total bill amount (${formatCurrency(bill.total_amount)})`);
      return;
    }

    try {
      await api.patch(`/bills/${bill.id}/paid`, { amount_paid: newPaid });
      setInlineEditBillId(null);
      loadLedgerData();
    } catch (err) {
      setInlineError(err.response?.data?.message || 'Failed to update amount paid');
    }
  };

  // Delete payment
  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Are you sure you want to delete this payment record? This will restore the bill balance.')) return;
    try {
      await api.delete(`/payments/${paymentId}`);
      loadLedgerData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete payment');
    }
  };

  // Unpaid bills for payment modal
  const unpaidBills = transactions.filter((t) => Number(t.amount_pending) > 0);

  return (
    <div className="space-y-6">
      {/* Top Bar with back link & actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/customers')}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
            title="Back to Customers"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-indigo-600" />
              Customer Ledger
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Live purchase history, payment tracking, and ledger balance statements
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setPaymentModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Payment</span>
          </button>

          <button
            onClick={() => navigate(`/customers/${id}/statement`)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs rounded-xl border border-indigo-200/60 transition-all cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>Customer Statement PDF</span>
          </button>
        </div>
      </div>

      {/* Customer Profile Card */}
      {customer && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xl shadow-inner">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">{customer.name}</h2>
                {customer.id !== 1 && (
                  <button
                    onClick={() => setEditProfileOpen(true)}
                    className="p-1 text-slate-400 hover:text-indigo-600 rounded-md transition-colors"
                    title="Edit Customer Profile"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                {customer.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {customer.phone}
                  </span>
                )}
                {customer.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {customer.address}
                  </span>
                )}
                <span>Customer ID: #{customer.id}</span>
              </div>
            </div>
          </div>

          {/* Current Live Pending Dues */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-right min-w-[200px]">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Outstanding Balance</p>
            <p className={`text-2xl font-black mt-1 ${
              Number(customer.pending_balance) > 0 ? 'text-amber-600' : 'text-emerald-600'
            }`}>
              {formatCurrency(customer.pending_balance || 0)}
            </p>
          </div>
        </div>
      )}

      {/* Period Filter Selector & View Toggle */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'custom', label: 'Custom Range' }
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePeriodPreset(p.id)}
                className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                  periodPreset === p.id
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Daily vs Monthly View Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'daily'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daily View
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'monthly'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly View
            </button>
          </div>
        </div>

        {/* Custom Range Inputs */}
        {periodPreset === 'custom' && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards for Selected Period */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Billed in Period
          </p>
          <p className="text-2xl font-black text-slate-900 mt-1">
            {formatCurrency(summary.total_billed)}
          </p>
          <p className="text-xs text-slate-400 mt-1">{summary.bill_count || 0} invoices recorded</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Payments in Period
          </p>
          <p className="text-2xl font-black text-emerald-600 mt-1">
            {formatCurrency(summary.total_paid)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Cleared customer payments</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Period Pending Balance
          </p>
          <p className={`text-2xl font-black mt-1 ${
            Number(summary.total_pending) > 0 ? 'text-amber-600' : 'text-slate-700'
          }`}>
            {formatCurrency(summary.total_pending)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Remaining dues for this period</p>
        </div>
      </div>

      {/* Transactions vs Payments History Tabs */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="flex items-center border-b border-slate-100 px-6 pt-3 gap-6 text-sm font-bold">
          <button
            onClick={() => setActiveTab('bills')}
            className={`pb-3 border-b-2 transition-all cursor-pointer ${
              activeTab === 'bills'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Bills & Purchases ({transactions.length})
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`pb-3 border-b-2 transition-all cursor-pointer ${
              activeTab === 'payments'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Payments History ({payments.length})
          </button>
        </div>

        {activeTab === 'bills' ? (
          viewMode === 'monthly' ? (
            /* Monthly Grouped View */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100 font-semibold">
                  <tr>
                    <th className="px-6 py-4">Month</th>
                    <th className="px-6 py-4 text-center">Invoices</th>
                    <th className="px-6 py-4 text-right">Total Billed</th>
                    <th className="px-6 py-4 text-right">Amount Paid</th>
                    <th className="px-6 py-4 text-right">Amount Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-10 text-center text-slate-400">
                        No transactions found in this date range.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((m) => (
                      <tr key={m.month} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 font-bold text-slate-900">{m.month}</td>
                        <td className="px-6 py-4 text-center font-medium">{m.bill_count}</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900">{formatCurrency(m.billed)}</td>
                        <td className="px-6 py-4 text-right font-semibold text-emerald-600">{formatCurrency(m.paid)}</td>
                        <td className="px-6 py-4 text-right font-bold text-amber-600">{formatCurrency(m.pending)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Daily Transactions Table */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100 font-semibold">
                  <tr>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Bill No</th>
                    <th className="px-6 py-4 text-center">Items</th>
                    <th className="px-6 py-4 text-right">Total</th>
                    <th className="px-6 py-4 text-right">Paid</th>
                    <th className="px-6 py-4 text-right">Pending</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-10 text-center text-slate-400">
                        No transactions recorded for this customer in this period.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((bill) => {
                      const isEditingPaid = inlineEditBillId === bill.id;

                      return (
                        <tr key={bill.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                            {formatDate(bill.bill_date)}
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-indigo-700">
                            {bill.bill_no}
                          </td>
                          <td className="px-6 py-4 text-center font-medium text-slate-700">
                            {bill.items_count || '-'}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-slate-900">
                            {formatCurrency(bill.total_amount)}
                          </td>

                          {/* Paid amount with Inline Quick Edit */}
                          <td className="px-6 py-4 text-right">
                            {isEditingPaid ? (
                              <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max={bill.total_amount}
                                    step="0.01"
                                    value={inlineEditPaidValue}
                                    onChange={(e) => setInlineEditPaidValue(e.target.value)}
                                    className="w-24 px-2 py-1 text-right text-xs font-bold border border-indigo-500 rounded-lg focus:outline-none"
                                  />
                                  <button
                                    onClick={() => handleSaveInlinePaid(bill)}
                                    className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md"
                                    title="Save"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setInlineEditBillId(null)}
                                    className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                {inlineError && (
                                  <span className="text-[10px] text-red-600 font-medium">{inlineError}</span>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5 group">
                                <span className="font-semibold text-emerald-600">
                                  {formatCurrency(bill.amount_paid)}
                                </span>
                                <button
                                  onClick={() => {
                                    setInlineEditBillId(bill.id);
                                    setInlineEditPaidValue(String(bill.amount_paid));
                                    setInlineError('');
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 transition-opacity"
                                  title="Quick Edit Paid Amount"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </td>

                          <td className="px-6 py-4 text-right font-bold">
                            <span className={Number(bill.amount_pending) > 0 ? 'text-amber-600' : 'text-slate-400'}>
                              {formatCurrency(bill.amount_pending)}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                              bill.status === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : bill.status === 'PARTIAL'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {bill.status}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => navigate(`/billing?editId=${bill.id}`)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                title="Edit Entire Bill"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Payments History List */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100 font-semibold">
                <tr>
                  <th className="px-6 py-4">Payment Date</th>
                  <th className="px-6 py-4">Applied Bill</th>
                  <th className="px-6 py-4">Mode</th>
                  <th className="px-6 py-4">Note</th>
                  <th className="px-6 py-4 text-right">Amount Paid</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-10 text-center text-slate-400">
                      No payment history recorded yet.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 text-xs text-slate-600 font-medium">
                        {formatDate(p.payment_date)}
                      </td>
                      <td className="px-6 py-4">
                        {p.bill_no ? (
                          <span className="font-mono font-bold text-indigo-600">{p.bill_no}</span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Oldest Unpaid FIFO</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">
                          {p.mode}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">{p.note || '-'}</td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-600">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeletePayment(p.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Payment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Customer Profile Modal */}
      {editProfileOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Edit Customer Profile</h3>
              <button onClick={() => setEditProfileOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateProfile} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                <input
                  type="text"
                  value={profileForm.address}
                  onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditProfileOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Update Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      <AddPaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        customer={customer}
        unpaidBills={unpaidBills}
        onPaymentSuccess={loadLedgerData}
      />
    </div>
  );
}
