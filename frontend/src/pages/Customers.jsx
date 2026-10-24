import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { formatCurrency } from '../utils/money';
import { formatDate } from '../utils/date';
import {
  Users,
  Plus,
  Search,
  BookOpen,
  Edit2,
  Trash2,
  Phone,
  MapPin,
  AlertCircle,
  X,
  CreditCard,
  UserCheck
} from 'lucide-react';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [hasPendingOnly, setHasPendingOnly] = useState(false);
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: ''
  });

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/customers', {
        params: {
          search: search || undefined,
          hasPending: hasPendingOnly ? 'true' : undefined
        }
      });
      if (res.data.success) {
        setCustomers(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [search, hasPendingOnly]);

  const openAddModal = () => {
    setSelectedCustomer(null);
    setFormData({ name: '', phone: '', address: '' });
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (cust) => {
    setSelectedCustomer(cust);
    setFormData({
      name: cust.name,
      phone: cust.phone || '',
      address: cust.address || ''
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      if (selectedCustomer) {
        await api.put(`/customers/${selectedCustomer.id}`, formData);
      } else {
        await api.post('/customers', formData);
      }
      setModalOpen(false);
      fetchCustomers();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save customer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!customerToDelete) return;
    try {
      await api.delete(`/customers/${customerToDelete.id}`);
      setDeleteModalOpen(false);
      setCustomerToDelete(null);
      fetchCustomers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete customer');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            Customers & Accounts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage customer directories, view ledgers, track total purchases and pending credit dues
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
          />
        </div>

        <label className="flex items-center gap-2.5 text-sm font-medium text-slate-700 cursor-pointer self-start sm:self-auto">
          <input
            type="checkbox"
            checked={hasPendingOnly}
            onChange={(e) => setHasPendingOnly(e.target.checked)}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
          />
          <span className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            Show only customers with pending dues
          </span>
        </label>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200 font-semibold">
              <tr>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Contact Info</th>
                <th className="px-6 py-4 text-right">Total Billed</th>
                <th className="px-6 py-4 text-right">Total Paid</th>
                <th className="px-6 py-4 text-right">Pending Balance</th>
                <th className="px-6 py-4">Last Purchase</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Loading customer accounts...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    No customers found.
                  </td>
                </tr>
              ) : (
                customers.map((cust) => {
                  const pending = Number(cust.pending_balance) || 0;
                  const isWalkIn = cust.id === 1;

                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                            isWalkIn ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-700'
                          }`}>
                            {isWalkIn ? 'W' : cust.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              {cust.name}
                              {isWalkIn && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium border border-slate-200">
                                  Default Walk-in
                                </span>
                              )}
                            </div>
                            {cust.address && (
                              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate max-w-[200px]">{cust.address}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-slate-700">
                        {cust.phone ? (
                          <div className="flex items-center gap-1.5 text-xs font-mono">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {cust.phone}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right font-medium text-slate-800">
                        {formatCurrency(cust.total_billed)}
                      </td>

                      <td className="px-6 py-4 text-right font-medium text-emerald-600">
                        {formatCurrency(cust.total_paid)}
                      </td>

                      <td className="px-6 py-4 text-right">
                        {pending > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            {formatCurrency(pending)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Clear (Rs. 0.00)
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs text-slate-500">
                        {formatDate(cust.last_purchase_date)}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            to={`/customers/${cust.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors border border-indigo-200/60"
                            title="View Customer Ledger"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>Ledger</span>
                          </Link>

                          {!isWalkIn && (
                            <>
                              <button
                                onClick={() => openEditModal(cust)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Edit Customer"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setCustomerToDelete(cust);
                                  setDeleteModalOpen(true);
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Customer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {selectedCustomer ? 'Edit Customer Details' : 'Add New Customer Profile'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Customer Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patel"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Address / City
                </label>
                <textarea
                  rows="2"
                  placeholder="e.g. 102 Green Heights, Main Market"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : selectedCustomer ? 'Update Profile' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Delete Customer?</h3>
            <p className="text-xs text-slate-500 mt-2">
              Are you sure you want to delete <span className="font-semibold text-slate-800">"{customerToDelete?.name}"</span>? This will archive the profile (soft delete).
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow-md shadow-red-600/20 cursor-pointer"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
