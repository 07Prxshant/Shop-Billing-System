import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Store, ShoppingCart, Users, Package } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-3xl p-6 lg:p-8 text-white shadow-xl shadow-indigo-600/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight">
              Welcome back, {user?.name || 'Shopkeeper'}! 👋
            </h1>
            <p className="text-indigo-100 text-sm mt-1">
              Here is your daily shop overview and billing activity.
            </p>
          </div>
          <Link
            to="/billing"
            className="inline-flex items-center gap-2 bg-white text-indigo-700 hover:bg-indigo-50 font-semibold px-5 py-3 rounded-xl shadow text-sm transition-all self-start md:self-auto"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Create New Bill</span>
          </Link>
        </div>
      </div>

      {/* Quick stats grid placeholder for Phase 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
            💰
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Today's Sales</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">Rs. 0.00</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl">
            📅
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">This Month</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">Rs. 1,523.80</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl">
            ⏳
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Pending Dues</p>
            <p className="text-xl font-bold text-amber-600 mt-0.5">Rs. 640.80</p>
          </div>
        </div>
      </div>
    </div>
  );
}
