import React, { useState } from 'react';
import api from '../api/client';
import { formatCurrency } from '../utils/money';
import { toInputDateFormat } from '../utils/date';
import { CreditCard, X, AlertCircle } from 'lucide-react';

export default function AddPaymentModal({
  isOpen,
  onClose,
  customer,
  unpaidBills = [],
  preselectedBillId = null,
  onPaymentSuccess
}) {
  if (!isOpen || !customer) return null;

  const maxBalance = Number(customer.pending_balance) || 0;

  const [amount, setAmount] = useState(
    preselectedBillId
      ? String(unpaidBills.find((b) => b.id === preselectedBillId)?.amount_pending || '')
      : ''
  );
  const [billId, setBillId] = useState(preselectedBillId ? String(preselectedBillId) : '');
  const [paymentDate, setPaymentDate] = useState(toInputDateFormat(new Date()));
  const [mode, setMode] = useState('CASH');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount greater than zero.');
      return;
    }

    if (numAmount > maxBalance) {
      setError(`Payment cannot exceed customer total pending balance (${formatCurrency(maxBalance)})`);
      return;
    }

    if (billId) {
      const selected = unpaidBills.find((b) => b.id === Number(billId));
      if (selected && numAmount > Number(selected.amount_pending)) {
        setError(`Payment cannot exceed bill pending balance (${formatCurrency(selected.amount_pending)})`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        customerId: customer.id,
        billId: billId ? Number(billId) : null,
        amount: numAmount,
        date: paymentDate,
        mode,
        note: note.trim()
      };

      const res = await api.post('/payments', payload);
      if (res.data.success) {
        onPaymentSuccess();
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Record Payment</h3>
              <p className="text-xs text-slate-500">Customer: {customer.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pending balance banner */}
        <div className="my-4 p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center justify-between text-xs">
          <span className="text-amber-800 font-medium">Customer Pending Balance:</span>
          <span className="text-base font-black text-amber-700">{formatCurrency(maxBalance)}</span>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Apply Payment To
            </label>
            <select
              value={billId}
              onChange={(e) => {
                setBillId(e.target.value);
                if (e.target.value) {
                  const b = unpaidBills.find((it) => it.id === Number(e.target.value));
                  if (b) setAmount(String(b.amount_pending));
                }
              }}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Apply automatically to oldest unpaid bills first (FIFO)</option>
              {unpaidBills.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bill_no} &bull; Pending: {formatCurrency(b.amount_pending)} ({b.bill_date})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Amount (Rs.) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={maxBalance}
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Payment Date *
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Payment Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['CASH', 'UPI', 'CARD'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    mode === m
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Note (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Paid via GPay / Cheque no..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || maxBalance <= 0}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Recording...' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
