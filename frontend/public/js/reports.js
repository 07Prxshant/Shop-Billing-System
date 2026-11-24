/**
 * Sales Reports & Analytics Controller (Vanilla JS)
 * Handles date range filters, daily/monthly groupings, collection charts, and CSV exports.
 */

let reportData = [];
let salesChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  // Set default dates: last 30 days
  const today = new Date();
  const past30 = new Date(Date.now() - 30 * 86400000);

  const fromInput = document.getElementById('report-from');
  const toInput = document.getElementById('report-to');

  if (fromInput) fromInput.value = toInputDateFormat(past30);
  if (toInput) toInput.value = toInputDateFormat(today);

  // Load report
  fetchSalesReport();

  // Bind controls
  const filterBtn = document.getElementById('apply-report-btn');
  const groupSelect = document.getElementById('report-group-by');
  const exportBtn = document.getElementById('export-csv-btn');

  if (filterBtn) filterBtn.addEventListener('click', fetchSalesReport);
  if (groupSelect) groupSelect.addEventListener('change', fetchSalesReport);
  if (exportBtn) exportBtn.addEventListener('click', exportReportCSV);
});

/**
 * Fetch sales report data from API
 */
async function fetchSalesReport() {
  const from = document.getElementById('report-from')?.value || '';
  const to = document.getElementById('report-to')?.value || '';
  const groupBy = document.getElementById('report-group-by')?.value || 'day';

  const loading = document.getElementById('report-loading');
  const content = document.getElementById('report-content');

  if (loading) loading.style.display = 'block';
  if (content) content.style.display = 'none';

  try {
    const res = await api.get('/reports/sales', { from, to, groupBy });
    if (res.success && res.data) {
      reportData = res.data;

      renderSummaryCards(reportData);
      renderReportTable(reportData);
      renderBarChart(reportData, groupBy);

      if (loading) loading.style.display = 'none';
      if (content) content.style.display = 'block';
    }
  } catch (err) {
    alert('Failed to load sales report: ' + err.message);
  } finally {
    if (loading) loading.style.display = 'none';
  }
}

/**
 * Render report KPI summary cards
 */
function renderSummaryCards(rows) {
  let countSum = 0;
  let totalSum = 0;
  let paidSum = 0;
  let pendingSum = 0;

  rows.forEach(r => {
    countSum += Number(r.count) || 0;
    totalSum += Number(r.total) || 0;
    paidSum += Number(r.paid) || 0;
    pendingSum += Number(r.pending) || 0;
  });

  document.getElementById('report-total-invoices').textContent = countSum;
  document.getElementById('report-total-sales').textContent = formatCurrency(totalSum);
  document.getElementById('report-total-paid').textContent = formatCurrency(paidSum);
  document.getElementById('report-total-pending').textContent = formatCurrency(pendingSum);
}

/**
 * Render tabular breakdown
 */
function renderReportTable(rows) {
  const tbody = document.getElementById('report-tbody');
  const empty = document.getElementById('report-empty');
  if (!tbody) return;

  if (rows.length === 0) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';

  let html = '';
  rows.forEach((r, idx) => {
    html += `
      <tr>
        <td style="font-weight: 600; width: 40px;">${idx + 1}</td>
        <td style="font-weight: 700; color: #0f172a;">${r.label}</td>
        <td style="text-align: center;">
          <span class="badge badge-category">${r.count}</span>
        </td>
        <td style="font-weight: 800; color: var(--primary);">
          ${formatCurrency(r.total)}
        </td>
        <td style="color: var(--success); font-weight: 700;">
          ${formatCurrency(r.paid)}
        </td>
        <td style="color: ${Number(r.pending) > 0 ? 'var(--danger-text)' : 'var(--text-muted)'}; font-weight: 700;">
          ${formatCurrency(r.pending)}
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

/**
 * Render Billed vs Paid comparison bar chart
 */
function renderBarChart(rows, groupBy) {
  const canvas = document.getElementById('report-chart');
  if (!canvas) return;

  const labels = rows.map(r => groupBy === 'day' ? formatDate(r.label) : r.label);
  const billedValues = rows.map(r => Number(r.total) || 0);
  const paidValues = rows.map(r => Number(r.paid) || 0);

  if (salesChartInstance) {
    salesChartInstance.destroy();
  }

  if (typeof Chart !== 'undefined') {
    salesChartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels.length > 0 ? labels : ['No Data'],
        datasets: [
          {
            label: 'Total Billed (Rs.)',
            data: billedValues.length > 0 ? billedValues : [0],
            backgroundColor: '#4f46e5',
            borderRadius: 6
          },
          {
            label: 'Amount Collected (Rs.)',
            data: paidValues.length > 0 ? paidValues : [0],
            backgroundColor: '#10b981',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              label: context => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: val => 'Rs. ' + val
            }
          }
        }
      }
    });
  }
}

/**
 * Export report as CSV download
 */
function exportReportCSV() {
  if (reportData.length === 0) {
    alert('No report data available to export.');
    return;
  }

  const from = document.getElementById('report-from')?.value || 'start';
  const to = document.getElementById('report-to')?.value || 'end';

  const headers = ['Period', 'Invoices Count', 'Total Billed (Rs)', 'Amount Paid (Rs)', 'Amount Pending (Rs)'];
  const csvRows = [headers.join(',')];

  reportData.forEach(r => {
    csvRows.push([
      `"${r.label}"`,
      r.count,
      Number(r.total || 0).toFixed(2),
      Number(r.paid || 0).toFixed(2),
      Number(r.pending || 0).toFixed(2)
    ].join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Sales_Report_${from}_to_${to}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
