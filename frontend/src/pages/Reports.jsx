import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { formatCurrency } from '../utils/money';
import { formatDate, toInputDateFormat } from '../utils/date';
import {
  BarChart3,
  Calendar,
  FileDown,
  TrendingUp,
  CreditCard,
  AlertCircle
} from 'lucide-react';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function Reports() {
  const today = new Date();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const [from, setFrom] = useState(toInputDateFormat(thirtyDaysAgo));
  const [to, setTo] = useState(toInputDateFormat(today));
  const [groupBy, setGroupBy] = useState('day');
  const [chartDataRows, setChartDataRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reports/sales', {
        params: {
          from: from || undefined,
          to: to || undefined,
          groupBy
        }
      });
      if (res.data.success) {
        setChartDataRows(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load sales report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [from, to, groupBy]);

  // Export CSV function
  const handleExportCSV = () => {
    if (chartDataRows.length === 0) {
      alert('No data available to export.');
      return;
    }

    const headers = ['Period', 'Invoices Count', 'Total Billed (Rs)', 'Amount Paid (Rs)', 'Amount Pending (Rs)'];
    const rows = chartDataRows.map((r) => [
      `"${r.label}"`,
      r.count,
      Number(r.total || 0).toFixed(2),
      Number(r.paid || 0).toFixed(2),
      Number(r.pending || 0).toFixed(2)
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Sales_Report_${from}_to_${to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Totals in range
  const totalBilled = chartDataRows.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
  const totalPaid = chartDataRows.reduce((sum, r) => sum + (Number(r.paid) || 0), 0);
  const totalPending = chartDataRows.reduce((sum, r) => sum + (Number(r.pending) || 0), 0);

  // Chart config
  const chartLabels = chartDataRows.map((r) => groupBy === 'day' ? formatDate(r.label) : r.label);
  const barChartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Total Billed',
        data: chartDataRows.map((r) => Number(r.total) || 0),
        backgroundColor: '#4f46e5',
        borderRadius: 6
      },
      {
        label: 'Amount Paid',
        data: chartDataRows.map((r) => Number(r.paid) || 0),
        backgroundColor: '#10b981',
        borderRadius: 6
      }
    ]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `Rs. ${value}`
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            Sales Reports & Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Analyze revenue performance, sales cycles, and export accounting CSV files
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer self-start sm:self-auto"
        >
          <FileDown className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Filter and Grouping Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-500 uppercase">From:</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-500 uppercase">To:</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Group By Toggle */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setGroupBy('day')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              groupBy === 'day'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Daily
          </button>
          <button
            onClick={() => setGroupBy('month')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              groupBy === 'month'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Period Metrics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Billed in Period
          </p>
          <p className="text-2xl font-black text-slate-900 mt-1">
            {formatCurrency(totalBilled)}
          </p>
          <p className="text-xs text-slate-400 mt-1">All invoices within date range</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Paid in Period
          </p>
          <p className="text-2xl font-black text-emerald-600 mt-1">
            {formatCurrency(totalPaid)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Cash and online collections</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Outstanding Pending in Period
          </p>
          <p className="text-2xl font-black text-amber-600 mt-1">
            {formatCurrency(totalPending)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Customer dues accrued</p>
        </div>
      </div>

      {/* Sales Comparison Chart */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <h3 className="font-bold text-slate-900 text-base mb-4">
          Sales & Collections Comparison
        </h3>
        <div className="h-72 w-full">
          {chartDataRows.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              No sales data found for the selected period.
            </div>
          ) : (
            <Bar data={barChartData} options={barChartOptions} />
          )}
        </div>
      </div>

      {/* Breakdown Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-sm">Periodic Breakdown</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100 font-semibold">
              <tr>
                <th className="px-6 py-4">Period</th>
                <th className="px-6 py-4 text-center">Invoices</th>
                <th className="px-6 py-4 text-right">Total Billed</th>
                <th className="px-6 py-4 text-right">Total Paid</th>
                <th className="px-6 py-4 text-right">Total Pending</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-10 text-center text-slate-400">
                    Loading report data...
                  </td>
                </tr>
              ) : chartDataRows.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-10 text-center text-slate-400">
                    No entries in this date range.
                  </td>
                </tr>
              ) : (
                chartDataRows.map((r) => (
                  <tr key={r.label} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {groupBy === 'day' ? formatDate(r.label) : r.label}
                    </td>
                    <td className="px-6 py-4 text-center font-medium">{r.count}</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">{formatCurrency(r.total)}</td>
                    <td className="px-6 py-4 text-right font-semibold text-emerald-600">{formatCurrency(r.paid)}</td>
                    <td className="px-6 py-4 text-right font-bold text-amber-600">{formatCurrency(r.pending)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
