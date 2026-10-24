import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { formatCurrency } from '../utils/money';
import { formatDate } from '../utils/date';
import { useAuth } from '../context/AuthContext';
import {
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  Users,
  Package,
  Calendar,
  CreditCard,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        const res = await api.get('/reports/dashboard');
        if (res.data.success) {
          setData(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <span>Loading shop dashboard...</span>
      </div>
    );
  }

  // Chart configuration for recent daily sales
  const chartLabels = (data?.recent_sales || []).map((s) => formatDate(s.label));
  const chartValues = (data?.recent_sales || []).map((s) => Number(s.total) || 0);

  const chartData = {
    labels: chartLabels.length > 0 ? chartLabels : ['Today'],
    datasets: [
      {
        label: 'Sales Revenue (Rs.)',
        data: chartValues.length > 0 ? chartValues : [data?.today_sales || 0],
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        tension: 0.35,
        fill: true,
        pointBackgroundColor: '#4f46e5',
        pointRadius: 4
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `Sales: ${formatCurrency(context.parsed.y)}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(226, 232, 240, 0.6)' },
        ticks: {
          callback: (value) => `Rs. ${value}`
        }
      },
      x: {
        grid: { display: false }
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 rounded-3xl p-6 lg:p-8 text-white shadow-xl shadow-indigo-950/20 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Shop POS & Ledger System
          </span>
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight">
            Welcome back, {user?.name || 'Shop Owner'}! 👋
          </h1>
          <p className="text-slate-300 text-sm mt-1">
            Real-time daily sales, monthly turnover, and outstanding customer ledger balances.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/billing"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-3 rounded-2xl shadow-lg shadow-indigo-600/30 text-sm transition-all"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Create New Bill</span>
          </Link>
          <Link
            to="/customers"
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-4 py-3 rounded-2xl backdrop-blur-sm text-sm transition-all"
          >
            <Users className="w-4 h-4" />
            <span>Customer Ledgers</span>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Today's Sales */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Today's Sales
            </p>
            <p className="text-2xl lg:text-3xl font-black text-slate-900 mt-1">
              {formatCurrency(data?.today_sales || 0)}
            </p>
            <p className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Live counter sales
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl shadow-inner">
            💵
          </div>
        </div>

        {/* This Month's Sales */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              This Month's Sales
            </p>
            <p className="text-2xl lg:text-3xl font-black text-indigo-700 mt-1">
              {formatCurrency(data?.month_sales || 0)}
            </p>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Cumulative monthly gross revenue
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl shadow-inner">
            📈
          </div>
        </div>

        {/* Total Pending Dues */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Pending Dues
            </p>
            <p className="text-2xl lg:text-3xl font-black text-amber-600 mt-1">
              {formatCurrency(data?.total_pending_dues || 0)}
            </p>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Uncollected customer credit
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl shadow-inner">
            ⏳
          </div>
        </div>
      </div>

      {/* Main Grid: Sales Trend Chart & Low Stock Alert */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sales Chart (8 cols) */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Sales Revenue Trend</h3>
              <p className="text-xs text-slate-400">Past days performance</p>
            </div>
            <Link
              to="/reports"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <span>Full Analytics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="h-64 w-full">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Low Stock Alerts (4 cols) */}
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Low Stock Alerts
            </h3>
            <Link
              to="/products"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              View All
            </Link>
          </div>

          <div className="space-y-3">
            {(!data?.low_stock_products || data.low_stock_products.length === 0) ? (
              <p className="text-xs text-emerald-600 font-semibold py-8 text-center">
                ✓ All items are well stocked!
              </p>
            ) : (
              data.low_stock_products.map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-2xl bg-amber-50/60 border border-amber-200/60 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-800">{p.name}</p>
                    <p className="text-[11px] text-slate-500">{p.category} &bull; {formatCurrency(p.price)}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    {p.stock_qty} left
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Top Customers & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Top Customers by Spending
            </h3>
            <Link to="/customers" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
              Directory
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {(!data?.top_customers || data.top_customers.length === 0) ? (
              <p className="text-xs text-slate-400 py-6 text-center">No customer purchases yet.</p>
            ) : (
              data.top_customers.map((c, i) => (
                <div key={c.customer_id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[11px]">
                      #{i + 1}
                    </span>
                    <div>
                      <Link
                        to={`/customers/${c.customer_id}`}
                        className="font-bold text-slate-900 hover:text-indigo-600 transition-colors"
                      >
                        {c.name}
                      </Link>
                      <p className="text-[11px] text-slate-400">{c.phone || 'No phone'} &bull; {c.bill_count} bills</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-slate-900 text-sm block">
                      {formatCurrency(c.total_spend)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-600" />
              Top Selling Products
            </h3>
            <Link to="/products" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
              Catalog
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {(!data?.top_products || data.top_products.length === 0) ? (
              <p className="text-xs text-slate-400 py-6 text-center">No product sales yet.</p>
            ) : (
              data.top_products.map((p, i) => (
                <div key={p.product_id} className="py-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[11px]">
                      #{i + 1}
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">{p.product_name}</p>
                      <p className="text-[11px] text-slate-400">{p.total_qty} units sold</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-indigo-700 text-sm block">
                      {formatCurrency(p.total_sales)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
