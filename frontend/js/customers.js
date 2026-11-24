/**
 * Customers Directory Controller (Vanilla JS)
 * Manages customer directory, credit/pending balances, and quick access to ledger.
 */

let allCustomers = [];
let editingCustomerId = null;
let customerToDeleteId = null;

document.addEventListener('DOMContentLoaded', async () => {
  await fetchCustomers();
  bindCustomerEvents();
});

/**
 * Fetch customers from API
 */
async function fetchCustomers() {
  const tbody = document.getElementById('customers-tbody');
  const loading = document.getElementById('customers-loading');
  const empty = document.getElementById('customers-empty');

  const search = document.getElementById('search-input')?.value || '';
  const hasPendingOnly = document.getElementById('filter-pending')?.checked;

  if (loading) loading.style.display = 'block';
  if (tbody) tbody.innerHTML = '';
  if (empty) empty.style.display = 'none';

  try {
    const res = await api.get('/customers', { 
      search, 
      hasPending: hasPendingOnly ? 'true' : undefined 
    });
    if (res.success) {
      allCustomers = res.data;
      renderCustomersTable(allCustomers);
    }
  } catch (err) {
    alert('Failed to load customers: ' + err.message);
  } finally {
    if (loading) loading.style.display = 'none';
  }
}

/**
 * Render customers in HTML table
 */
function renderCustomersTable(customers) {
  const tbody = document.getElementById('customers-tbody');
  const empty = document.getElementById('customers-empty');
  const countEl = document.getElementById('customers-count');

  if (!tbody) return;

  if (customers.length === 0) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    if (countEl) countEl.textContent = '0 customers';
    return;
  }

  if (empty) empty.style.display = 'none';

  let html = '';
  customers.forEach((c, idx) => {
    const pendingBalance = Number(c.pending_balance) || 0;
    const isWalkIn = c.id === 1;

    html += `
      <tr>
        <td style="font-weight: 600; width: 30px;">${idx + 1}</td>
        <td>
          <div style="font-weight: 700; color: #0f172a;">
            <a href="customer-ledger.html?id=${c.id}" style="color: var(--primary); text-decoration: none;">
              ${c.name}
            </a>
            ${isWalkIn ? '<span class="badge badge-category" style="margin-left: 6px;">Walk-in</span>' : ''}
          </div>
        </td>
        <td>
          <div style="font-size: 13px; color: #334155;">${c.phone || '-'}</div>
        </td>
        <td>
          <div style="font-size: 12px; color: var(--text-muted); max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${c.address || '-'}
          </div>
        </td>
        <td style="font-weight: 700; color: #0f172a;">
          ${formatCurrency(c.total_billed)}
        </td>
        <td style="color: var(--success); font-weight: 600;">
          ${formatCurrency(c.total_paid)}
        </td>
        <td style="font-weight: 800; color: ${pendingBalance > 0 ? 'var(--danger-text)' : 'var(--success-text)'};">
          ${formatCurrency(pendingBalance)}
        </td>
        <td class="actions-cell">
          <a href="customer-ledger.html?id=${c.id}" class="btn btn-sm btn-outline" title="View Ledger & Statement">
            📖 Ledger
          </a>
          <button type="button" class="btn-icon" onclick="openEditModal(${c.id})" title="Edit Customer">
            ✏️
          </button>
          ${isWalkIn ? '' : `
            <button type="button" class="btn-icon btn-icon-danger" onclick="openDeleteModal(${c.id}, '${c.name}')" title="Delete Customer">
              🗑️
            </button>
          `}
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
  if (countEl) countEl.textContent = `${customers.length} customers`;
}

/**
 * Open Modal to Add Customer
 */
window.openAddCustomerModal = function() {
  editingCustomerId = null;
  document.getElementById('modal-title').textContent = 'Add New Customer';
  document.getElementById('customer-form').reset();
  document.getElementById('modal-error').style.display = 'none';
  document.getElementById('customer-modal').classList.add('active');
};

/**
 * Open Modal to Edit Customer
 */
window.openEditModal = function(id) {
  const c = allCustomers.find(item => item.id === id);
  if (!c) return;

  editingCustomerId = id;
  document.getElementById('modal-title').textContent = 'Edit Customer Profile';
  document.getElementById('modal-error').style.display = 'none';

  document.getElementById('cust-name').value = c.name;
  document.getElementById('cust-phone').value = c.phone || '';
  document.getElementById('cust-address').value = c.address || '';

  document.getElementById('customer-modal').classList.add('active');
};

/**
 * Close Customer Modal
 */
window.closeCustomerModal = function() {
  document.getElementById('customer-modal').classList.remove('active');
};

/**
 * Handle Add/Edit Form Submit
 */
async function handleCustomerFormSubmit(e) {
  e.preventDefault();
  const errorBox = document.getElementById('modal-error');
  errorBox.style.display = 'none';

  const name = document.getElementById('cust-name').value.trim();
  const phone = document.getElementById('cust-phone').value.trim();
  const address = document.getElementById('cust-address').value.trim();

  if (!name) {
    errorBox.textContent = 'Please enter customer name.';
    errorBox.style.display = 'block';
    return;
  }

  const payload = { name, phone, address };

  try {
    let res;
    if (editingCustomerId) {
      res = await api.put(`/customers/${editingCustomerId}`, payload);
    } else {
      res = await api.post('/customers', payload);
    }

    if (res.success) {
      closeCustomerModal();
      await fetchCustomers();
    } else {
      errorBox.textContent = res.message || 'Failed to save customer.';
      errorBox.style.display = 'block';
    }
  } catch (err) {
    errorBox.textContent = err.message || 'Network error.';
    errorBox.style.display = 'block';
  }
}

/**
 * Delete confirmation modal
 */
window.openDeleteModal = function(id, name) {
  customerToDeleteId = id;
  document.getElementById('delete-cust-name').textContent = name;
  document.getElementById('delete-modal').classList.add('active');
};

window.closeDeleteModal = function() {
  customerToDeleteId = null;
  document.getElementById('delete-modal').classList.remove('active');
};

window.confirmDeleteCustomer = async function() {
  if (!customerToDeleteId) return;

  try {
    const res = await api.delete(`/customers/${customerToDeleteId}`);
    if (res.success) {
      closeDeleteModal();
      await fetchCustomers();
    } else {
      alert(res.message || 'Failed to delete customer.');
    }
  } catch (err) {
    alert('Delete error: ' + err.message);
  }
};

/**
 * Bind Search and Filter events
 */
function bindCustomerEvents() {
  const searchInput = document.getElementById('search-input');
  const pendingFilter = document.getElementById('filter-pending');
  const form = document.getElementById('customer-form');

  if (searchInput) searchInput.addEventListener('input', fetchCustomers);
  if (pendingFilter) pendingFilter.addEventListener('change', fetchCustomers);
  if (form) form.addEventListener('submit', handleCustomerFormSubmit);
}
