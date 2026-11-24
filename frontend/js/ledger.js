/**
 * Customer Ledger & Khata Statement Controller (Vanilla JS)
 * Manages customer account ledger, transaction history, payment collection, and statement generation.
 */

let customerId = null;
let currentCustomer = null;
let currentSummary = null;
let currentTransactions = [];
let currentPayments = [];
let unpaidBills = [];

let viewMode = 'daily'; // 'daily' | 'monthly'
let activeTab = 'bills'; // 'bills' | 'payments'

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  customerId = urlParams.get('id');

  if (!customerId) {
    alert('No customer selected.');
    window.location.href = 'customers.html';
    return;
  }

  // Load ledger data
  await loadLedger();

  // Bind UI controls
  bindLedgerEvents();
});

/**
 * Load complete customer ledger data
 */
async function loadLedger() {
  const loading = document.getElementById('ledger-loading');
  const content = document.getElementById('ledger-content');

  const from = document.getElementById('filter-from')?.value || '';
  const to = document.getElementById('filter-to')?.value || '';

  if (loading) loading.style.display = 'block';
  if (content) content.style.display = 'none';

  try {
    const params = { from, to, view: viewMode };

    const [custRes, sumRes, txRes, payRes] = await Promise.all([
      api.get(`/customers/${customerId}`),
      api.get(`/customers/${customerId}/summary`, { from, to }),
      api.get(`/customers/${customerId}/transactions`, params),
      api.get('/payments', { customerId })
    ]);

    if (!custRes.success) throw new Error('Customer not found');

    currentCustomer = custRes.data;
    currentSummary = sumRes.data || { total_billed: 0, total_paid: 0, total_pending: 0, bill_count: 0 };
    currentTransactions = txRes.data || [];
    currentPayments = payRes.data || [];

    // Filter unpaid bills for payment modal
    unpaidBills = currentTransactions.filter(b => Number(b.amount_pending) > 0);

    renderCustomerHeader(currentCustomer);
    renderSummaryCards(currentSummary);
    renderLedgerTables();

    if (loading) loading.style.display = 'none';
    if (content) content.style.display = 'block';

  } catch (err) {
    alert('Failed to load ledger: ' + err.message);
  }
}

/**
 * Render customer profile header
 */
function renderCustomerHeader(cust) {
  document.getElementById('cust-name').textContent = cust.name;
  document.getElementById('cust-phone').textContent = cust.phone ? `📞 ${cust.phone}` : 'No phone';
  document.getElementById('cust-address').textContent = cust.address ? `📍 ${cust.address}` : 'No address on file';
  document.getElementById('cust-created').textContent = `Customer since ${formatDate(cust.created_at)}`;
}

/**
 * Render KPI summary cards
 */
function renderSummaryCards(sum) {
  document.getElementById('kpi-billed').textContent = formatCurrency(sum.total_billed || 0);
  document.getElementById('kpi-paid').textContent = formatCurrency(sum.total_paid || 0);
  
  const pendingEl = document.getElementById('kpi-pending');
  const pendingVal = Number(sum.total_pending) || 0;
  pendingEl.textContent = formatCurrency(pendingVal);
  pendingEl.style.color = pendingVal > 0 ? 'var(--danger-text)' : 'var(--success-text)';

  document.getElementById('kpi-bills-count').textContent = sum.bill_count || 0;
}

/**
 * Render active tab table (Bills vs Payments)
 */
function renderLedgerTables() {
  if (activeTab === 'bills') {
    document.getElementById('bills-table-container').style.display = 'block';
    document.getElementById('payments-table-container').style.display = 'none';
    renderBillsTable();
  } else {
    document.getElementById('bills-table-container').style.display = 'none';
    document.getElementById('payments-table-container').style.display = 'block';
    renderPaymentsTable();
  }
}

/**
 * Render Bills / Transactions Table
 */
function renderBillsTable() {
  const tbody = document.getElementById('bills-tbody');
  const emptyNotice = document.getElementById('bills-empty');
  if (!tbody) return;

  if (currentTransactions.length === 0) {
    tbody.innerHTML = '';
    if (emptyNotice) emptyNotice.style.display = 'block';
    return;
  }

  if (emptyNotice) emptyNotice.style.display = 'none';

  let html = '';
  if (viewMode === 'monthly') {
    // Grouped monthly view
    currentTransactions.forEach(m => {
      html += `
        <tr>
          <td style="font-weight: 800; color: var(--primary);">${m.month}</td>
          <td style="font-weight: 700;">${m.bill_count} invoices</td>
          <td style="font-weight: 800;">${formatCurrency(m.billed)}</td>
          <td style="color: var(--success); font-weight: 600;">${formatCurrency(m.paid)}</td>
          <td style="color: ${Number(m.pending) > 0 ? 'var(--danger-text)' : 'var(--text-muted)'}; font-weight: 700;">
            ${formatCurrency(m.pending)}
          </td>
          <td>
            <span class="badge ${Number(m.pending) <= 0 ? 'badge-paid' : 'badge-partial'}">
              ${Number(m.pending) <= 0 ? 'CLEARED' : 'PENDING'}
            </span>
          </td>
          <td style="text-align: right;">-</td>
        </tr>
      `;
    });
  } else {
    // Daily detailed invoices view
    currentTransactions.forEach(b => {
      const statusClass = `badge-${(b.status || 'UNPAID').toLowerCase()}`;
      html += `
        <tr>
          <td style="font-weight: 800; color: var(--primary);">${b.bill_no}</td>
          <td>${formatDate(b.bill_date)}</td>
          <td style="font-weight: 800; color: #0f172a;">${formatCurrency(b.total_amount)}</td>
          <td style="color: var(--success); font-weight: 600;">${formatCurrency(b.amount_paid)}</td>
          <td style="color: ${Number(b.amount_pending) > 0 ? 'var(--danger-text)' : 'var(--text-muted)'}; font-weight: 700;">
            ${formatCurrency(b.amount_pending)}
          </td>
          <td><span class="badge ${statusClass}">${b.status}</span></td>
          <td style="font-size: 11px; color: var(--text-muted);">${b.payment_mode || 'CASH'}</td>
          <td class="actions-cell">
            ${Number(b.amount_pending) > 0 ? `
              <button type="button" class="btn btn-sm btn-outline" onclick="openRecordPaymentModal(${b.id})" title="Pay this bill">
                💵 Settle
              </button>
            ` : ''}
            <a href="billing.html?editId=${b.id}" class="btn-icon" title="Edit Bill">✏️</a>
            <button type="button" class="btn-icon btn-icon-danger" onclick="deleteBill(${b.id})" title="Delete Bill">🗑️</button>
          </td>
        </tr>
      `;
    });
  }

  tbody.innerHTML = html;
}

/**
 * Render Payment History Table
 */
function renderPaymentsTable() {
  const tbody = document.getElementById('payments-tbody');
  const emptyNotice = document.getElementById('payments-empty');
  if (!tbody) return;

  if (currentPayments.length === 0) {
    tbody.innerHTML = '';
    if (emptyNotice) emptyNotice.style.display = 'block';
    return;
  }

  if (emptyNotice) emptyNotice.style.display = 'none';

  let html = '';
  currentPayments.forEach((p, idx) => {
    html += `
      <tr>
        <td style="font-weight: 600;">${idx + 1}</td>
        <td>${formatDate(p.payment_date)}</td>
        <td style="font-weight: 800; color: var(--success);">${formatCurrency(p.amount)}</td>
        <td><span class="badge badge-category">${p.mode || 'CASH'}</span></td>
        <td style="font-weight: 600; color: #475569;">${p.bill_no || 'On Account / Advance'}</td>
        <td style="font-size: 12px; color: var(--text-muted);">${p.note || '-'}</td>
        <td style="text-align: right;">
          <button type="button" class="btn-icon btn-icon-danger" onclick="deletePayment(${p.id})" title="Delete Payment Record">
            🗑️
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

/**
 * Switch active tabs (Bills vs Payments)
 */
window.switchTab = function(tabName) {
  activeTab = tabName;
  document.getElementById('tab-bills').classList.toggle('active', tabName === 'bills');
  document.getElementById('tab-payments').classList.toggle('active', tabName === 'payments');
  renderLedgerTables();
};

/**
 * Switch view mode (Daily vs Monthly)
 */
window.setViewMode = function(mode) {
  viewMode = mode;
  document.getElementById('view-daily-btn').classList.toggle('btn-primary', mode === 'daily');
  document.getElementById('view-daily-btn').classList.toggle('btn-outline', mode !== 'daily');
  document.getElementById('view-monthly-btn').classList.toggle('btn-primary', mode === 'monthly');
  document.getElementById('view-monthly-btn').classList.toggle('btn-outline', mode !== 'monthly');
  loadLedger();
};

/**
 * Apply Period Presets
 */
window.applyPreset = function(preset) {
  const today = new Date();
  const fromInput = document.getElementById('filter-from');
  const toInput = document.getElementById('filter-to');

  if (preset === 'today') {
    const d = toInputDateFormat(today);
    if (fromInput) fromInput.value = d;
    if (toInput) toInput.value = d;
  } else if (preset === 'this_month') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    if (fromInput) fromInput.value = toInputDateFormat(first);
    if (toInput) toInput.value = toInputDateFormat(last);
  } else if (preset === 'last_month') {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    if (fromInput) fromInput.value = toInputDateFormat(first);
    if (toInput) toInput.value = toInputDateFormat(last);
  } else if (preset === 'all') {
    if (fromInput) fromInput.value = '';
    if (toInput) toInput.value = '';
  }

  loadLedger();
};

/**
 * Open Record Payment Modal
 */
window.openRecordPaymentModal = function(preselectedBillId = null) {
  const modal = document.getElementById('payment-modal');
  if (!modal) return;

  const dueVal = Number(currentSummary?.total_pending) || 0;
  document.getElementById('pay-due-balance').textContent = formatCurrency(dueVal);

  const billSelect = document.getElementById('pay-bill-select');
  if (billSelect) {
    billSelect.innerHTML = '<option value="">Oldest Unpaid Bills First (FIFO)</option>';
    unpaidBills.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `${b.bill_no} (Pending: Rs. ${b.amount_pending})`;
      if (preselectedBillId && b.id === preselectedBillId) opt.selected = true;
      billSelect.appendChild(opt);
    });
  }

  const amtInput = document.getElementById('pay-amount');
  if (amtInput) {
    if (preselectedBillId) {
      const b = unpaidBills.find(it => it.id === preselectedBillId);
      amtInput.value = b ? b.amount_pending : dueVal;
    } else {
      amtInput.value = dueVal > 0 ? dueVal : '';
    }
  }

  const dateInput = document.getElementById('pay-date');
  if (dateInput) dateInput.value = toInputDateFormat(new Date());

  document.getElementById('pay-error').style.display = 'none';
  modal.classList.add('active');
};

window.closePaymentModal = function() {
  document.getElementById('payment-modal').classList.remove('active');
};

/**
 * Submit Payment Form
 */
async function handlePaymentSubmit(e) {
  e.preventDefault();
  const errorBox = document.getElementById('pay-error');
  errorBox.style.display = 'none';

  const amount = parseFloat(document.getElementById('pay-amount').value);
  const billId = document.getElementById('pay-bill-select').value || null;
  const date = document.getElementById('pay-date').value || toInputDateFormat(new Date());
  const mode = document.getElementById('pay-mode').value || 'CASH';
  const note = document.getElementById('pay-notes').value || '';

  if (isNaN(amount) || amount <= 0) {
    errorBox.textContent = 'Please enter a valid payment amount greater than zero.';
    errorBox.style.display = 'block';
    return;
  }

  const payload = {
    customerId: Number(customerId),
    billId: billId ? Number(billId) : null,
    amount,
    date,
    mode,
    note: note.trim()
  };

  try {
    const res = await api.post('/payments', payload);
    if (res.success) {
      closePaymentModal();
      await loadLedger();
    } else {
      errorBox.textContent = res.message || 'Payment failed.';
      errorBox.style.display = 'block';
    }
  } catch (err) {
    errorBox.textContent = err.message || 'Payment error.';
    errorBox.style.display = 'block';
  }
}

/**
 * Delete a payment record
 */
window.deletePayment = async function(paymentId) {
  if (!confirm('Are you sure you want to delete this payment record? This will adjust customer pending balance.')) {
    return;
  }
  try {
    const res = await api.delete(`/payments/${paymentId}`);
    if (res.success) {
      await loadLedger();
    } else {
      alert(res.message || 'Failed to delete payment.');
    }
  } catch (err) {
    alert('Error deleting payment: ' + err.message);
  }
};

/**
 * Delete a bill
 */
window.deleteBill = async function(billId) {
  if (!confirm('Are you sure you want to delete this bill? Stock quantities will be restored.')) {
    return;
  }
  try {
    const res = await api.delete(`/bills/${billId}`);
    if (res.success) {
      await loadLedger();
    } else {
      alert(res.message || 'Failed to delete bill.');
    }
  } catch (err) {
    alert('Error deleting bill: ' + err.message);
  }
};

/**
 * Print Statement
 */
window.printStatement = function() {
  if (typeof printCustomerStatement === 'function') {
    const from = document.getElementById('filter-from')?.value || '';
    const to = document.getElementById('filter-to')?.value || '';
    printCustomerStatement(customerId, from, to);
  } else {
    window.print();
  }
};

/**
 * Bind Ledger UI events
 */
function bindLedgerEvents() {
  const fromInput = document.getElementById('filter-from');
  const toInput = document.getElementById('filter-to');
  const payForm = document.getElementById('payment-form');

  if (fromInput) fromInput.addEventListener('change', loadLedger);
  if (toInput) toInput.addEventListener('change', loadLedger);
  if (payForm) payForm.addEventListener('submit', handlePaymentSubmit);
}
