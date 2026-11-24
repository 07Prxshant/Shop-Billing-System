/**
 * Bills & Invoices History Controller (Vanilla JS)
 * Handles invoice filtering, viewing line items, printing, and deleting.
 */

let allBills = [];
let billIdToDelete = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Load customers for filter dropdown
  await loadCustomerFilter();

  // Load bills list
  await fetchBills();

  // Bind filter change events
  bindFilterEvents();
});

/**
 * Load customers into filter dropdown
 */
async function loadCustomerFilter() {
  try {
    const res = await api.get('/customers');
    const select = document.getElementById('filter-customer');
    if (res.success && select) {
      res.data.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Failed to load customers for filter:', err);
  }
}

/**
 * Fetch bills with query filters
 */
async function fetchBills() {
  const tbody = document.getElementById('bills-tbody');
  const loading = document.getElementById('bills-loading');
  const empty = document.getElementById('bills-empty');

  const from = document.getElementById('filter-from')?.value || '';
  const to = document.getElementById('filter-to')?.value || '';
  const customerId = document.getElementById('filter-customer')?.value || '';
  const status = document.getElementById('filter-status')?.value || '';

  if (loading) loading.style.display = 'block';
  if (tbody) tbody.innerHTML = '';
  if (empty) empty.style.display = 'none';

  try {
    const res = await api.get('/bills', { from, to, customerId, status });
    if (res.success) {
      allBills = res.data;
      renderBillsTable(allBills);
    }
  } catch (err) {
    alert('Failed to load bills: ' + err.message);
  } finally {
    if (loading) loading.style.display = 'none';
  }
}

/**
 * Render bills in HTML table
 */
function renderBillsTable(bills) {
  const tbody = document.getElementById('bills-tbody');
  const empty = document.getElementById('bills-empty');
  const countEl = document.getElementById('bills-count-badge');
  const totalEl = document.getElementById('bills-total-revenue');

  if (!tbody) return;

  if (bills.length === 0) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    if (countEl) countEl.textContent = '0 Invoices';
    if (totalEl) totalEl.textContent = 'Rs. 0.00';
    return;
  }

  if (empty) empty.style.display = 'none';

  let totalSum = 0;
  let html = '';

  bills.forEach((b, index) => {
    totalSum += Number(b.total_amount) || 0;
    const statusClass = `badge-${(b.status || 'UNPAID').toLowerCase()}`;

    html += `
      <tr>
        <td style="font-weight: 800; color: var(--primary);">
          ${b.bill_no}
        </td>
        <td style="white-space: nowrap;">
          ${formatDate(b.bill_date)}
        </td>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${b.customer_name || 'Walk-in Customer'}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${b.customer_phone || ''}</div>
        </td>
        <td style="text-align: center;">
          <span class="badge badge-category">${b.items_count || 1} items</span>
        </td>
        <td style="font-weight: 800; color: #0f172a;">
          ${formatCurrency(b.total_amount)}
        </td>
        <td style="color: var(--success); font-weight: 600;">
          ${formatCurrency(b.amount_paid)}
        </td>
        <td style="color: ${Number(b.amount_pending) > 0 ? 'var(--danger-text)' : 'var(--text-muted)'}; font-weight: 600;">
          ${formatCurrency(b.amount_pending)}
        </td>
        <td>
          <span class="badge ${statusClass}">${b.status}</span>
        </td>
        <td style="font-size: 11px; color: var(--text-muted);">
          ${b.payment_mode || 'CASH'}
        </td>
        <td class="actions-cell">
          <button type="button" class="btn-icon" onclick="viewBillDetails(${b.id})" title="View / Print Invoice">
            👁️
          </button>
          <button type="button" class="btn-icon" onclick="editBill(${b.id})" title="Edit Bill">
            ✏️
          </button>
          <button type="button" class="btn-icon btn-icon-danger" onclick="openDeleteModal(${b.id}, '${b.bill_no}')" title="Delete Bill">
            🗑️
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
  if (countEl) countEl.textContent = `${bills.length} Invoices`;
  if (totalEl) totalEl.textContent = formatCurrency(totalSum);
}

/**
 * View detailed invoice in a modal dialog
 */
window.viewBillDetails = async function(id) {
  try {
    const res = await api.get(`/bills/${id}`);
    if (!res.success || !res.data) {
      throw new Error('Bill not found');
    }

    const b = res.data;

    document.getElementById('modal-invoice-no').textContent = b.bill_no;
    document.getElementById('modal-invoice-date').textContent = formatDate(b.bill_date);
    document.getElementById('modal-invoice-cust-name').textContent = b.customer_name || 'Walk-in Customer';
    document.getElementById('modal-invoice-cust-phone').textContent = b.customer_phone ? `Phone: ${b.customer_phone}` : '';
    document.getElementById('modal-invoice-cust-addr').textContent = b.customer_address ? `Address: ${b.customer_address}` : '';
    document.getElementById('modal-invoice-mode').textContent = b.payment_mode || 'CASH';
    document.getElementById('modal-invoice-status').textContent = b.status;
    document.getElementById('modal-invoice-status').className = `badge badge-${(b.status || '').toLowerCase()}`;

    // Items table
    const itemsTbody = document.getElementById('modal-invoice-items');
    if (itemsTbody) {
      let itemsHtml = '';
      (b.items || []).forEach((it, idx) => {
        itemsHtml += `
          <tr>
            <td>${idx + 1}</td>
            <td style="font-weight: 600;">${it.product_name}</td>
            <td>${formatCurrency(it.rate)}</td>
            <td>${it.qty}</td>
            <td>${it.gst_percent || 0}%</td>
            <td style="text-align: right; font-weight: 700;">${formatCurrency(it.amount)}</td>
          </tr>
        `;
      });
      itemsTbody.innerHTML = itemsHtml;
    }

    document.getElementById('modal-invoice-subtotal').textContent = formatCurrency(b.subtotal);
    document.getElementById('modal-invoice-discount').textContent = formatCurrency(b.discount);
    document.getElementById('modal-invoice-tax').textContent = formatCurrency(b.tax);
    document.getElementById('modal-invoice-total').textContent = formatCurrency(b.total_amount);
    document.getElementById('modal-invoice-paid').textContent = formatCurrency(b.amount_paid);
    document.getElementById('modal-invoice-pending').textContent = formatCurrency(b.amount_pending);
    document.getElementById('modal-invoice-notes').textContent = b.notes || 'None';

    // Bind Print button
    const printBtn = document.getElementById('modal-print-btn');
    if (printBtn) {
      printBtn.onclick = () => {
        if (typeof printInvoice === 'function') {
          printInvoice(b.id);
        } else {
          window.print();
        }
      };
    }

    const modal = document.getElementById('view-bill-modal');
    if (modal) modal.classList.add('active');
  } catch (err) {
    alert('Failed to load bill details: ' + err.message);
  }
};

/**
 * Edit Bill navigation
 */
window.editBill = function(id) {
  window.location.href = `billing.html?editId=${id}`;
};

/**
 * Delete confirmation modal
 */
window.openDeleteModal = function(id, billNo) {
  billIdToDelete = id;
  const noEl = document.getElementById('delete-bill-no');
  if (noEl) noEl.textContent = billNo;
  const modal = document.getElementById('delete-bill-modal');
  if (modal) modal.classList.add('active');
};

window.closeDeleteModal = function() {
  billIdToDelete = null;
  const modal = document.getElementById('delete-bill-modal');
  if (modal) modal.classList.remove('active');
};

window.confirmDelete = async function() {
  if (!billIdToDelete) return;
  try {
    const res = await api.delete(`/bills/${billIdToDelete}`);
    if (res.success) {
      closeDeleteModal();
      await fetchBills();
    } else {
      alert(res.message || 'Failed to delete bill.');
    }
  } catch (err) {
    alert('Error deleting bill: ' + err.message);
  }
};

window.closeViewModal = function() {
  const modal = document.getElementById('view-bill-modal');
  if (modal) modal.classList.remove('active');
};

/**
 * Bind filter events
 */
function bindFilterEvents() {
  const fromInput = document.getElementById('filter-from');
  const toInput = document.getElementById('filter-to');
  const custSelect = document.getElementById('filter-customer');
  const statusSelect = document.getElementById('filter-status');
  const resetBtn = document.getElementById('filter-reset-btn');

  if (fromInput) fromInput.addEventListener('change', fetchBills);
  if (toInput) toInput.addEventListener('change', fetchBills);
  if (custSelect) custSelect.addEventListener('change', fetchBills);
  if (statusSelect) statusSelect.addEventListener('change', fetchBills);

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (fromInput) fromInput.value = '';
      if (toInput) toInput.value = '';
      if (custSelect) custSelect.value = '';
      if (statusSelect) statusSelect.value = '';
      fetchBills();
    });
  }
}
