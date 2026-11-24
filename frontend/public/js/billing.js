/**
 * POS Billing & Invoicing Controller (Vanilla JS)
 * Manages customer selection, product cart, live GST calculations, and bill creation/editing.
 */

// Cart and state
let allCustomers = [];
let allProducts = [];
let cart = []; // Array of { product_id, product_name, rate, qty, gst_percent }
let editBillId = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Check for editId parameter in URL
  const urlParams = new URLSearchParams(window.location.search);
  editBillId = urlParams.get('editId');

  // Set default bill date to today
  const billDateInput = document.getElementById('bill-date');
  if (billDateInput) {
    billDateInput.value = toInputDateFormat(new Date());
  }

  // Load master data
  await loadInitialData();

  // Bind event listeners
  bindEvents();
});

/**
 * Fetch products and customers from API
 */
async function loadInitialData() {
  try {
    const [custRes, prodRes] = await Promise.all([
      api.get('/customers'),
      api.get('/products')
    ]);

    if (custRes.success) {
      allCustomers = custRes.data;
      populateCustomerDropdown(allCustomers);
    }

    if (prodRes.success) {
      allProducts = prodRes.data;
      populateProductGrid(allProducts);
    }

    // If editing existing bill
    if (editBillId) {
      await loadExistingBill(editBillId);
    }
  } catch (err) {
    alert('Failed to load customers or products: ' + err.message);
  }
}

/**
 * Populate customer select options
 */
function populateCustomerDropdown(customers) {
  const select = document.getElementById('customer-select');
  if (!select) return;

  select.innerHTML = '';
  customers.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} (${c.phone || 'No phone'})${Number(c.pending_balance) > 0 ? ' [Due: Rs. ' + c.pending_balance + ']' : ''}`;
    select.appendChild(opt);
  });
}

/**
 * Populate product quick selection list
 */
function populateProductGrid(products) {
  const container = document.getElementById('product-catalog');
  if (!container) return;

  if (products.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); padding: 12px; font-size: 13px;">No products found.</div>';
    return;
  }

  let html = '';
  products.forEach(p => {
    const isOutOfStock = p.stock_qty <= 0;
    html += `
      <div 
        class="product-item" 
        onclick="${isOutOfStock ? '' : `addProductToCart(${p.id})`}"
        style="padding: 10px 12px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: ${isOutOfStock ? '#f8fafc' : '#ffffff'}; cursor: ${isOutOfStock ? 'not-allowed' : 'pointer'}; margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; transition: all 0.15s ease;"
      >
        <div>
          <div style="font-weight: 700; font-size: 13px; color: ${isOutOfStock ? '#94a3b8' : '#0f172a'};">${p.name}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${p.category || 'General'} &bull; GST: ${p.gst_percent || 0}%</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 800; font-size: 13px; color: var(--primary);">${formatCurrency(p.price)}</div>
          <div style="font-size: 11px; font-weight: 600; color: ${isOutOfStock ? 'var(--danger-text)' : 'var(--text-muted)'};">
            ${isOutOfStock ? 'Out of Stock' : p.stock_qty + ' in stock'}
          </div>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

/**
 * Filter products catalog search
 */
function filterProducts(query) {
  const q = query.toLowerCase().trim();
  const filtered = allProducts.filter(p => 
    p.name.toLowerCase().includes(q) || 
    (p.category && p.category.toLowerCase().includes(q))
  );
  populateProductGrid(filtered);
}

/**
 * Add a product to current cart
 */
window.addProductToCart = function(productId) {
  const prod = allProducts.find(p => p.id === productId);
  if (!prod) return;

  if (prod.stock_qty <= 0) {
    alert(`"${prod.name}" is currently out of stock.`);
    return;
  }

  const existing = cart.find(it => it.product_id === prod.id);
  if (existing) {
    if (existing.qty + 1 > prod.stock_qty) {
      alert(`Cannot exceed available stock (${prod.stock_qty} units).`);
      return;
    }
    existing.qty += 1;
  } else {
    cart.push({
      product_id: prod.id,
      product_name: prod.name,
      rate: Number(prod.price),
      qty: 1,
      gst_percent: Number(prod.gst_percent) || 0,
      stock_qty: prod.stock_qty
    });
  }

  renderCart();
  calculateTotals();
};

/**
 * Render items in cart table
 */
function renderCart() {
  const tbody = document.getElementById('cart-tbody');
  const emptyNotice = document.getElementById('cart-empty-notice');
  if (!tbody) return;

  if (cart.length === 0) {
    tbody.innerHTML = '';
    if (emptyNotice) emptyNotice.style.display = 'block';
    return;
  }

  if (emptyNotice) emptyNotice.style.display = 'none';

  let html = '';
  cart.forEach((item, index) => {
    const lineTotal = item.qty * item.rate;
    html += `
      <tr>
        <td style="font-weight: 600;">${index + 1}</td>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${item.product_name}</div>
          <div style="font-size: 11px; color: var(--text-muted);">Stock limit: ${item.stock_qty}</div>
        </td>
        <td style="width: 100px;">
          <input 
            type="number" 
            class="form-control" 
            style="padding: 4px 6px; font-size: 12px;" 
            value="${item.rate}" 
            min="0" 
            step="0.01" 
            onchange="updateItemRate(${index}, this.value)"
          >
        </td>
        <td style="width: 130px;">
          <div class="qty-control">
            <button type="button" class="qty-btn" onclick="updateItemQty(${index}, ${item.qty - 1})">-</button>
            <input 
              type="number" 
              class="qty-input" 
              value="${item.qty}" 
              min="1" 
              max="${item.stock_qty}" 
              onchange="updateItemQty(${index}, this.value)"
            >
            <button type="button" class="qty-btn" onclick="updateItemQty(${index}, ${item.qty + 1})">+</button>
          </div>
        </td>
        <td>
          <span class="badge badge-category">${item.gst_percent}%</span>
        </td>
        <td style="font-weight: 800; color: #0f172a; text-align: right;">
          ${formatCurrency(lineTotal)}
        </td>
        <td style="text-align: center;">
          <button type="button" class="btn-icon btn-icon-danger" onclick="removeItemFromCart(${index})" title="Remove item">
            🗑️
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

/**
 * Update quantity for cart row
 */
window.updateItemQty = function(index, newQty) {
  const qty = parseInt(newQty, 10);
  if (isNaN(qty) || qty <= 0) {
    removeItemFromCart(index);
    return;
  }

  const item = cart[index];
  if (qty > item.stock_qty) {
    alert(`Cannot exceed available stock (${item.stock_qty} units).`);
    item.qty = item.stock_qty;
  } else {
    item.qty = qty;
  }

  renderCart();
  calculateTotals();
};

/**
 * Update unit rate for cart row
 */
window.updateItemRate = function(index, newRate) {
  const rate = parseFloat(newRate);
  if (isNaN(rate) || rate < 0) return;
  cart[index].rate = rate;
  renderCart();
  calculateTotals();
};

/**
 * Remove item from cart
 */
window.removeItemFromCart = function(index) {
  cart.splice(index, 1);
  renderCart();
  calculateTotals();
};

/**
 * Live GST & Invoice Totals calculation
 */
function calculateTotals() {
  const discountInput = document.getElementById('bill-discount');
  const paidInput = document.getElementById('bill-paid');

  const discount = Math.max(0, parseFloat(discountInput?.value) || 0);
  const userPaid = parseFloat(paidInput?.value);

  // 1. Subtotal
  let subtotal = 0;
  cart.forEach(item => {
    subtotal += item.qty * item.rate;
  });

  // 2. Discount distribution & GST Calculation
  const discountRatio = subtotal > 0 ? Math.max(0, subtotal - discount) / subtotal : 1;
  let totalTax = 0;

  cart.forEach(item => {
    const lineAmount = item.qty * item.rate;
    const taxableAmount = lineAmount * discountRatio;
    const lineTax = taxableAmount * (item.gst_percent / 100);
    totalTax += lineTax;
  });

  // 3. Grand Total
  const totalAmount = Math.max(0, Math.round((subtotal - discount + totalTax) * 100) / 100);

  // 4. Amount Paid & Pending
  let amountPaid = isNaN(userPaid) ? 0 : Math.max(0, userPaid);
  if (amountPaid > totalAmount) {
    amountPaid = totalAmount;
    if (paidInput) paidInput.value = amountPaid;
  }

  const pending = Math.max(0, Math.round((totalAmount - amountPaid) * 100) / 100);

  // 5. Determine Bill Status
  let status = 'UNPAID';
  if (amountPaid >= totalAmount && totalAmount > 0) {
    status = 'PAID';
  } else if (amountPaid > 0) {
    status = 'PARTIAL';
  }

  // 6. Update Summary UI
  const subtotalDisplay = document.getElementById('summary-subtotal');
  const taxDisplay = document.getElementById('summary-tax');
  const grandTotalDisplay = document.getElementById('summary-grand-total');
  const pendingDisplay = document.getElementById('summary-pending');
  const statusBadge = document.getElementById('summary-status-badge');

  if (subtotalDisplay) subtotalDisplay.textContent = formatCurrency(subtotal);
  if (taxDisplay) taxDisplay.textContent = formatCurrency(totalTax);
  if (grandTotalDisplay) grandTotalDisplay.textContent = formatCurrency(totalAmount);
  if (pendingDisplay) pendingDisplay.textContent = formatCurrency(pending);

  if (statusBadge) {
    statusBadge.textContent = status;
    statusBadge.className = `badge badge-${status.toLowerCase()}`;
  }

  return { subtotal, discount, totalTax, totalAmount, amountPaid, pending, status };
}

/**
 * Handle Full Payment quick button
 */
window.setFullPayment = function() {
  const totals = calculateTotals();
  const paidInput = document.getElementById('bill-paid');
  if (paidInput) {
    paidInput.value = totals.totalAmount;
    calculateTotals();
  }
};

/**
 * Handle Unpaid quick button
 */
window.setZeroPayment = function() {
  const paidInput = document.getElementById('bill-paid');
  if (paidInput) {
    paidInput.value = '0';
    calculateTotals();
  }
};

/**
 * Save / Create Bill
 */
async function submitBill() {
  if (cart.length === 0) {
    alert('Please add at least one product to the cart before saving the bill.');
    return;
  }

  const customerSelect = document.getElementById('customer-select');
  const billDateInput = document.getElementById('bill-date');
  const paymentModeSelect = document.getElementById('payment-mode');
  const notesInput = document.getElementById('bill-notes');
  const submitBtn = document.getElementById('save-bill-btn');

  const customerId = parseInt(customerSelect?.value, 10) || 1;
  const billDate = billDateInput?.value || toInputDateFormat(new Date());
  const paymentMode = paymentModeSelect?.value || 'CASH';
  const notes = notesInput?.value || '';

  const totals = calculateTotals();

  const payload = {
    customer_id: customerId,
    bill_date: billDate,
    items: cart.map(item => ({
      product_id: item.product_id,
      product_name: item.product_name,
      rate: item.rate,
      qty: item.qty,
      gst_percent: item.gst_percent
    })),
    discount: totals.discount,
    amount_paid: totals.amountPaid,
    payment_mode: paymentMode,
    notes: notes.trim()
  };

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving Bill...';
    }

    let result;
    if (editBillId) {
      result = await api.put(`/bills/${editBillId}`, payload);
    } else {
      result = await api.post('/bills', payload);
    }

    if (result.success && result.data) {
      showSuccessModal(result.data);
    } else {
      alert(result.message || 'Failed to save bill.');
    }
  } catch (err) {
    alert('Error saving bill: ' + err.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = editBillId ? 'Update Bill' : 'Save & Print Invoice';
    }
  }
}

/**
 * Show Invoice Success Modal with print/download options
 */
function showSuccessModal(bill) {
  const modal = document.getElementById('bill-success-modal');
  if (!modal) return;

  const numEl = document.getElementById('success-bill-no');
  const dateEl = document.getElementById('success-bill-date');
  const totalEl = document.getElementById('success-bill-total');
  const statusEl = document.getElementById('success-bill-status');

  if (numEl) numEl.textContent = bill.bill_no || 'BILL-GENERATED';
  if (dateEl) dateEl.textContent = formatDate(bill.bill_date);
  if (totalEl) totalEl.textContent = formatCurrency(bill.total_amount);
  if (statusEl) {
    statusEl.textContent = bill.status;
    statusEl.className = `badge badge-${(bill.status || '').toLowerCase()}`;
  }

  // Bind print button to print helper
  const printBtn = document.getElementById('success-print-btn');
  if (printBtn) {
    printBtn.onclick = () => {
      if (typeof printInvoice === 'function') {
        printInvoice(bill.id || editBillId);
      } else {
        window.print();
      }
    };
  }

  modal.classList.add('active');
}

/**
 * Reset form to create a new bill
 */
window.resetBillingForm = function() {
  cart = [];
  editBillId = null;
  const discountInput = document.getElementById('bill-discount');
  const paidInput = document.getElementById('bill-paid');
  const notesInput = document.getElementById('bill-notes');
  const modal = document.getElementById('bill-success-modal');

  if (discountInput) discountInput.value = '0';
  if (paidInput) paidInput.value = '0';
  if (notesInput) notesInput.value = '';
  if (modal) modal.classList.remove('active');

  renderCart();
  calculateTotals();
};

/**
 * Load existing bill for editing
 */
async function loadExistingBill(id) {
  try {
    const res = await api.get(`/bills/${id}`);
    if (!res.success || !res.data) return;

    const b = res.data;
    const custSelect = document.getElementById('customer-select');
    const dateInput = document.getElementById('bill-date');
    const discountInput = document.getElementById('bill-discount');
    const paidInput = document.getElementById('bill-paid');
    const modeSelect = document.getElementById('payment-mode');
    const notesInput = document.getElementById('bill-notes');
    const pageHeader = document.querySelector('.page-title');

    if (pageHeader) pageHeader.innerHTML = `<span>✏️</span> Edit Bill ${b.bill_no}`;
    if (custSelect) custSelect.value = b.customer_id;
    if (dateInput) dateInput.value = b.bill_date;
    if (discountInput) discountInput.value = b.discount;
    if (paidInput) paidInput.value = b.amount_paid;
    if (modeSelect) modeSelect.value = b.payment_mode || 'CASH';
    if (notesInput) notesInput.value = b.notes || '';

    // Populate cart
    cart = (b.items || []).map(item => ({
      product_id: item.product_id,
      product_name: item.product_name,
      rate: Number(item.rate),
      qty: Number(item.qty),
      gst_percent: Number(item.gst_percent) || 0,
      stock_qty: 9999 // Existing item
    }));

    renderCart();
    calculateTotals();
  } catch (err) {
    alert('Failed to load bill for editing: ' + err.message);
  }
}

/**
 * Bind input and search events
 */
function bindEvents() {
  const prodSearchInput = document.getElementById('product-search');
  if (prodSearchInput) {
    prodSearchInput.addEventListener('input', (e) => {
      filterProducts(e.target.value);
    });
  }

  const discountInput = document.getElementById('bill-discount');
  if (discountInput) {
    discountInput.addEventListener('input', calculateTotals);
  }

  const paidInput = document.getElementById('bill-paid');
  if (paidInput) {
    paidInput.addEventListener('input', calculateTotals);
  }

  const saveBtn = document.getElementById('save-bill-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', submitBill);
  }
}
