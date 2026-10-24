import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { formatCurrency, round2 } from '../utils/money';
import { calculateBillTotals } from '../utils/calc';
import { toInputDateFormat } from '../utils/date';
import { generateInvoicePDF } from '../utils/pdfGenerator';
import {
  ShoppingCart,
  User,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  Receipt,
  Search,
  ArrowRight,
  Printer,
  FileDown,
  AlertCircle
} from 'lucide-react';

export default function Billing() {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('editId');
  const navigate = useNavigate();

  // Master data
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState(1); // default Walk-in
  const [billDate, setBillDate] = useState(toInputDateFormat(new Date()));
  const [cartItems, setCartItems] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [notes, setNotes] = useState('');

  // Product search dropdown
  const [productSearch, setProductSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successBill, setSuccessBill] = useState(null);

  // Load products and customers
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingInitial(true);
        const [custRes, prodRes] = await Promise.all([
          api.get('/customers'),
          api.get('/products')
        ]);

        if (custRes.data.success) setCustomers(custRes.data.data);
        if (prodRes.data.success) setProducts(prodRes.data.data);

        // If editing an existing bill
        if (editId) {
          const billRes = await api.get(`/bills/${editId}`);
          if (billRes.data.success) {
            const b = billRes.data.data;
            setSelectedCustomerId(b.customer_id);
            setBillDate(b.bill_date);
            setDiscount(b.discount);
            setAmountPaid(b.amount_paid);
            setPaymentMode(b.payment_mode || 'CASH');
            setNotes(b.notes || '');

            if (b.items && b.items.length > 0) {
              setCartItems(
                b.items.map((it) => ({
                  product_id: it.product_id,
                  product_name: it.product_name,
                  rate: Number(it.rate),
                  gst_percent: Number(it.gst_percent),
                  qty: Number(it.qty)
                }))
              );
            }
          }
        }
      } catch (err) {
        console.error('Failed to load billing data:', err);
        setErrorMessage('Failed to load customers or products');
      } finally {
        setLoadingInitial(false);
      }
    }
    loadData();
  }, [editId]);

  // Live calculations
  const totals = calculateBillTotals(cartItems, discount, amountPaid);

  // Add product to cart
  const addToCart = (product) => {
    if (product.stock_qty <= 0) {
      alert(`Cannot add "${product.name}". Out of stock.`);
      return;
    }

    setCartItems((prev) => {
      const existing = prev.find((it) => it.product_id === product.id);
      if (existing) {
        if (existing.qty + 1 > product.stock_qty) {
          alert(`Cannot add more. Only ${product.stock_qty} in stock.`);
          return prev;
        }
        return prev.map((it) =>
          it.product_id === product.id ? { ...it, qty: it.qty + 1 } : it
        );
      } else {
        return [
          ...prev,
          {
            product_id: product.id,
            product_name: product.name,
            rate: Number(product.price),
            gst_percent: Number(product.gst_percent || 0),
            qty: 1
          }
        ];
      }
    });
    setProductSearch('');
  };

  const updateItemQty = (productId, newQty) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    const product = products.find((p) => p.id === productId);
    if (product && newQty > product.stock_qty) {
      alert(`Only ${product.stock_qty} available in stock.`);
      return;
    }

    setCartItems((prev) =>
      prev.map((it) =>
        it.product_id === productId ? { ...it, qty: newQty } : it
      )
    );
  };

  const removeFromCart = (productId) => {
    setCartItems((prev) => prev.filter((it) => it.product_id !== productId));
  };

  // Quick pay helpers
  const handlePayFull = () => {
    setAmountPaid(totals.total_amount);
  };

  const handlePayZero = () => {
    setAmountPaid(0);
    setPaymentMode('CREDIT');
  };

  // Submit bill
  const handleSaveBill = async (e) => {
    e.preventDefault();
    if (cartItems.length === 0) {
      setErrorMessage('Please add at least one product to the cart.');
      return;
    }

    setErrorMessage('');
    setSubmitting(true);

    try {
      const payload = {
        customer_id: selectedCustomerId,
        bill_date: billDate,
        items: cartItems.map((it) => ({
          product_id: it.product_id,
          qty: it.qty,
          rate: it.rate,
          gst_percent: it.gst_percent
        })),
        discount: Number(discount) || 0,
        amount_paid: Number(amountPaid) || 0,
        payment_mode: paymentMode,
        notes: notes.trim()
      };

      let res;
      if (editId) {
        res = await api.put(`/bills/${editId}`, payload);
      } else {
        res = await api.post('/bills', payload);
      }

      if (res.data.success) {
        setSuccessBill(res.data.data);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to save bill');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter products for quick search
  const filteredProducts = productSearch.trim()
    ? products.filter((p) =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.category && p.category.toLowerCase().includes(productSearch.toLowerCase()))
      )
    : [];

  const selectedCustomer = customers.find((c) => c.id === Number(selectedCustomerId));

  if (loadingInitial) {
    return (
      <div className="py-20 text-center text-slate-400">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <span>Loading Point of Sale system...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-indigo-600" />
            {editId ? `Edit Bill #${editId}` : 'New POS Bill'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create invoices, select items, apply discounts, and manage instant customer credit
          </p>
        </div>
        {editId && (
          <button
            onClick={() => navigate('/bills')}
            className="text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors self-start sm:self-auto"
          >
            &larr; Back to Bills List
          </button>
        )}
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Billing Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Customer & Cart (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Customer Selection Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <User className="w-4 h-4 text-indigo-600" />
              Customer Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Customer
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 text-slate-800"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bill Date
                </label>
                <input
                  type="date"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>
            </div>

            {selectedCustomer && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Address: <strong className="text-slate-700">{selectedCustomer.address || 'Walk-in Store'}</strong>
                </span>
                <span>
                  Current Pending Balance:{' '}
                  <strong className={Number(selectedCustomer.pending_balance) > 0 ? 'text-amber-600 font-bold' : 'text-emerald-600'}>
                    {formatCurrency(selectedCustomer.pending_balance || 0)}
                  </strong>
                </span>
              </div>
            )}
          </div>

          {/* Product Picker */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Search className="w-4 h-4 text-indigo-600" />
              Add Products to Cart
            </h3>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Type product name or category to search and add..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 text-slate-800"
              />

              {/* Autocomplete dropdown */}
              {productSearch.trim() && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-20 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {filteredProducts.length === 0 ? (
                    <div className="p-3 text-xs text-slate-400 text-center">
                      No matching products found.
                    </div>
                  ) : (
                    filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => addToCart(p)}
                        className="w-full text-left p-3 hover:bg-indigo-50/70 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{p.name}</p>
                          <span className="text-xs text-slate-400">{p.category || 'General'} &bull; GST {p.gst_percent}%</span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-900 text-sm">{formatCurrency(p.price)}</p>
                          <span className={`text-[11px] font-semibold ${p.stock_qty <= 5 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            Stock: {p.stock_qty}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Cart Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <span>Items in Cart</span>
                <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-bold">
                  {cartItems.length}
                </span>
              </h3>
              {cartItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCartItems([])}
                  className="text-xs text-red-600 hover:text-red-700 font-medium cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {cartItems.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <ShoppingCart className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium">Cart is currently empty.</p>
                <p className="text-xs mt-1">Search and select products above to begin billing.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-400 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3 text-right">Rate</th>
                      <th className="px-4 py-3 text-center">Qty</th>
                      <th className="px-4 py-3 text-right">GST %</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cartItems.map((item) => {
                      const lineTotal = round2(item.qty * item.rate);
                      return (
                        <tr key={item.product_id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            {item.product_name}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-700">
                            {formatCurrency(item.rate)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateItemQty(item.product_id, item.qty - 1)}
                                className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-8 text-center font-bold text-slate-800 text-xs">
                                {item.qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateItemQty(item.product_id, item.qty + 1)}
                                className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-slate-500">
                            {item.gst_percent}%
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900">
                            {formatCurrency(lineTotal)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.product_id)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded-md transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Calculations & Payment Summary (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-lg">
            <h3 className="text-base font-bold text-slate-900 pb-4 border-b border-slate-100 flex items-center justify-between">
              <span>Bill Summary</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                totals.status === 'PAID'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : totals.status === 'PARTIAL'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                {totals.status}
              </span>
            </h3>

            {/* Calculations Breakdown */}
            <div className="py-4 space-y-3 text-sm text-slate-600 border-b border-slate-100">
              <div className="flex justify-between">
                <span>Subtotal (SUM of items)</span>
                <span className="font-semibold text-slate-800">{formatCurrency(totals.subtotal)}</span>
              </div>

              {/* Discount Input */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-medium text-slate-600">Discount Amount (Rs.)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                  className="w-28 px-3 py-1.5 text-right font-medium bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-between text-xs text-slate-500">
                <span>Taxable Value</span>
                <span>{formatCurrency(Math.max(0, totals.subtotal - totals.discount))}</span>
              </div>

              <div className="flex justify-between text-xs text-slate-500">
                <span>GST Tax (calculated per item)</span>
                <span className="text-slate-700 font-medium">+{formatCurrency(totals.tax)}</span>
              </div>

              {/* Grand Total */}
              <div className="pt-2 flex justify-between items-baseline border-t border-slate-200/60">
                <span className="text-base font-bold text-slate-900">Total Amount</span>
                <span className="text-2xl font-black text-indigo-700">{formatCurrency(totals.total_amount)}</span>
              </div>
            </div>

            {/* Payment Section */}
            <div className="pt-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Amount Paid Now *
                  </label>
                  <div className="flex gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={handlePayFull}
                      className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200 hover:bg-emerald-100"
                    >
                      Pay Full
                    </button>
                    <button
                      type="button"
                      onClick={handlePayZero}
                      className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold hover:bg-slate-200"
                    >
                      Full Credit (0)
                    </button>
                  </div>
                </div>

                <input
                  type="number"
                  min="0"
                  max={totals.total_amount}
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(Math.max(0, Number(e.target.value)))}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Amount Pending Box */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Balance Amount Pending</p>
                  <p className="text-xs text-slate-400">Added to customer ledger</p>
                </div>
                <div className={`text-lg font-black ${totals.amount_pending > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {formatCurrency(totals.amount_pending)}
                </div>
              </div>

              {/* Payment Mode */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Payment Mode
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['CASH', 'UPI', 'CARD', 'CREDIT'].map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMode(mode)}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        paymentMode === mode
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Bill Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Festival offer, Home delivery..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Save Button */}
              <button
                type="button"
                onClick={handleSaveBill}
                disabled={submitting || cartItems.length === 0}
                className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-sm shadow-xl shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing Bill...</span>
                  </>
                ) : (
                  <>
                    <Receipt className="w-5 h-5" />
                    <span>{editId ? 'Update & Save Bill' : 'Save & Generate Invoice'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bill Created Success Modal */}
      {successBill && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-black text-slate-900">
              Bill Generated Successfully!
            </h3>
            <p className="text-sm font-mono font-bold text-indigo-600 mt-1">
              Invoice #{successBill.bill_no}
            </p>

            <div className="my-5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Billed:</span>
                <span className="font-bold text-slate-800">{formatCurrency(successBill.total_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Paid:</span>
                <span className="font-bold text-emerald-600">{formatCurrency(successBill.amount_paid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pending Dues:</span>
                <span className={`font-bold ${successBill.amount_pending > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                  {formatCurrency(successBill.amount_pending)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold uppercase">{successBill.status}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const setRes = await api.get('/settings');
                    generateInvoicePDF(successBill, setRes.data?.data || {});
                  } catch (e) {
                    generateInvoicePDF(successBill, {});
                  }
                }}
                className="py-2.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center gap-1.5 border border-indigo-200/60"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSuccessBill(null);
                  navigate(`/bills`);
                }}
                className="py-2.5 px-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50"
              >
                Bills List
              </button>
              <button
                type="button"
                onClick={() => {
                  setSuccessBill(null);
                  setCartItems([]);
                  setDiscount(0);
                  setAmountPaid(0);
                  setNotes('');
                }}
                className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/20"
              >
                New Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
