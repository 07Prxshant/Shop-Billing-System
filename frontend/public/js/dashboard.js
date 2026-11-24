/**
 * Dashboard Controller (Vanilla JS)
 * Fetches and renders KPIs, Sales Chart, Low Stock Alerts, Top Customers & Products.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const loadingIndicator = document.getElementById('dashboard-loading');
  const contentArea = document.getElementById('dashboard-content');

  try {
    const res = await api.get('/reports/dashboard');
    if (!res.success || !res.data) {
      throw new Error('Failed to load dashboard data');
    }

    const data = res.data;

    // 1. Set KPI Cards
    const todaySalesEl = document.getElementById('kpi-today-sales');
    const monthSalesEl = document.getElementById('kpi-month-sales');
    const pendingDuesEl = document.getElementById('kpi-pending-dues');

    if (todaySalesEl) todaySalesEl.textContent = formatCurrency(data.today_sales || 0);
    if (monthSalesEl) monthSalesEl.textContent = formatCurrency(data.month_sales || 0);
    if (pendingDuesEl) pendingDuesEl.textContent = formatCurrency(data.total_pending_dues || 0);

    // 2. Render Low Stock Alerts
    renderLowStock(data.low_stock_products || []);

    // 3. Render Top Customers
    renderTopCustomers(data.top_customers || []);

    // 4. Render Top Products
    renderTopProducts(data.top_products || []);

    // 5. Render Sales Revenue Trend Chart
    renderSalesChart(data.recent_sales || []);

    // Show content
    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (contentArea) contentArea.style.display = 'block';

  } catch (err) {
    console.error('Dashboard Error:', err);
    if (loadingIndicator) {
      loadingIndicator.innerHTML = `
        <div class="alert alert-danger" style="max-width: 500px; margin: 40px auto;">
          <span>⚠️</span>
          <span>Failed to load dashboard metrics. ${err.message}</span>
        </div>
      `;
    }
  }
});

/**
 * Render low stock warning list
 */
function renderLowStock(products) {
  const listEl = document.getElementById('low-stock-list');
  if (!listEl) return;

  if (products.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; padding: 24px; color: var(--success); font-weight: 600; font-size: 13px;">
        ✓ All products have sufficient inventory!
      </div>
    `;
    return;
  }

  let html = '';
  products.forEach(p => {
    html += `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--radius-md); margin-bottom: 8px;">
        <div>
          <div style="font-weight: 700; font-size: 13px; color: #1e293b;">${p.name}</div>
          <div style="font-size: 11px; color: #64748b;">${p.category || 'General'} &bull; ${formatCurrency(p.price)}</div>
        </div>
        <span class="badge badge-stock-low">
          ${p.stock_qty} left (Min: ${p.low_stock_limit})
        </span>
      </div>
    `;
  });
  listEl.innerHTML = html;
}

/**
 * Render top customers table / list
 */
function renderTopCustomers(customers) {
  const listEl = document.getElementById('top-customers-list');
  if (!listEl) return;

  if (customers.length === 0) {
    listEl.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted); font-size: 13px;">No sales recorded yet.</div>';
    return;
  }

  let html = '';
  customers.forEach((c, index) => {
    html += `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-light);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="width: 24px; height: 24px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #475569;">
            #${index + 1}
          </span>
          <div>
            <a href="customer-ledger.html?id=${c.customer_id}" style="font-weight: 700; font-size: 13px; color: var(--primary);">
              ${c.name}
            </a>
            <div style="font-size: 11px; color: var(--text-muted);">${c.phone || 'No phone'} &bull; ${c.bill_count} bills</div>
          </div>
        </div>
        <div style="font-weight: 800; font-size: 14px; color: #0f172a;">
          ${formatCurrency(c.total_spend)}
        </div>
      </div>
    `;
  });
  listEl.innerHTML = html;
}

/**
 * Render top products table / list
 */
function renderTopProducts(products) {
  const listEl = document.getElementById('top-products-list');
  if (!listEl) return;

  if (products.length === 0) {
    listEl.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted); font-size: 13px;">No product sales yet.</div>';
    return;
  }

  let html = '';
  products.forEach((p, index) => {
    html += `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-light);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="width: 24px; height: 24px; border-radius: 50%; background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;">
            #${index + 1}
          </span>
          <div>
            <div style="font-weight: 700; font-size: 13px; color: #0f172a;">${p.product_name}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${p.total_qty} units sold</div>
          </div>
        </div>
        <div style="font-weight: 800; font-size: 14px; color: var(--primary);">
          ${formatCurrency(p.total_sales)}
        </div>
      </div>
    `;
  });
  listEl.innerHTML = html;
}

/**
 * Render sales trend chart (Chart.js or canvas visualizer)
 */
function renderSalesChart(recentSales) {
  const canvas = document.getElementById('sales-trend-chart');
  if (!canvas) return;

  const labels = recentSales.map(item => formatDate(item.label));
  const values = recentSales.map(item => Number(item.total) || 0);

  if (typeof Chart !== 'undefined') {
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels.length > 0 ? labels : ['Today'],
        datasets: [{
          label: 'Sales Revenue (Rs.)',
          data: values.length > 0 ? values : [0],
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79, 70, 229, 0.1)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: '#4f46e5',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: value => 'Rs. ' + value
            }
          }
        }
      }
    });
  }
}
