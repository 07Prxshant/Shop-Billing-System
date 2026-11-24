/**
 * Products & Inventory Controller (Vanilla JS)
 * Manages product catalog, stock updates, GST rates, and low stock thresholds.
 */

let allProducts = [];
let editingProductId = null;
let productToDeleteId = null;

document.addEventListener('DOMContentLoaded', async () => {
  await fetchProducts();
  bindProductEvents();
});

/**
 * Fetch products from API
 */
async function fetchProducts() {
  const tbody = document.getElementById('products-tbody');
  const loading = document.getElementById('products-loading');
  const empty = document.getElementById('products-empty');

  const search = document.getElementById('search-input')?.value || '';
  const category = document.getElementById('category-filter')?.value || '';

  if (loading) loading.style.display = 'block';
  if (tbody) tbody.innerHTML = '';
  if (empty) empty.style.display = 'none';

  try {
    const res = await api.get('/products', { search, category });
    if (res.success) {
      allProducts = res.data;
      updateCategoryDropdown(allProducts);
      renderProductsTable(allProducts);
    }
  } catch (err) {
    alert('Failed to load products: ' + err.message);
  } finally {
    if (loading) loading.style.display = 'none';
  }
}

/**
 * Update Category Filter options
 */
function updateCategoryDropdown(products) {
  const select = document.getElementById('category-filter');
  if (!select) return;

  const currentVal = select.value;
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

  select.innerHTML = '<option value="">All Categories</option>';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    if (cat === currentVal) opt.selected = true;
    select.appendChild(opt);
  });
}

/**
 * Render products table
 */
function renderProductsTable(products) {
  const tbody = document.getElementById('products-tbody');
  const empty = document.getElementById('products-empty');
  const countEl = document.getElementById('products-count');

  if (!tbody) return;

  if (products.length === 0) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    if (countEl) countEl.textContent = '0 items';
    return;
  }

  if (empty) empty.style.display = 'none';

  let html = '';
  products.forEach((p, idx) => {
    const isLowStock = Number(p.stock_qty) <= Number(p.low_stock_limit);
    const stockBadge = isLowStock 
      ? `<span class="badge badge-stock-low">⚠️ ${p.stock_qty} (Low)</span>` 
      : `<span class="badge badge-stock-ok">✓ ${p.stock_qty} in stock</span>`;

    html += `
      <tr>
        <td style="font-weight: 600; width: 30px;">${idx + 1}</td>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${p.name}</div>
        </td>
        <td>
          <span class="badge badge-category">${p.category || 'General'}</span>
        </td>
        <td style="font-weight: 800; color: var(--primary);">
          ${formatCurrency(p.price)}
        </td>
        <td>
          <span class="badge badge-category">${p.gst_percent || 0}%</span>
        </td>
        <td>
          ${stockBadge}
        </td>
        <td style="color: var(--text-muted); font-size: 12px;">
          ${p.low_stock_limit || 5}
        </td>
        <td class="actions-cell">
          <button type="button" class="btn-icon" onclick="openEditModal(${p.id})" title="Edit Product">
            ✏️
          </button>
          <button type="button" class="btn-icon btn-icon-danger" onclick="openDeleteModal(${p.id}, '${p.name}')" title="Delete Product">
            🗑️
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
  if (countEl) countEl.textContent = `${products.length} products`;
}

/**
 * Open Modal to Add Product
 */
window.openAddProductModal = function() {
  editingProductId = null;
  document.getElementById('modal-title').textContent = 'Add New Product';
  document.getElementById('product-form').reset();
  document.getElementById('modal-error').style.display = 'none';
  document.getElementById('product-modal').classList.add('active');
};

/**
 * Open Modal to Edit Product
 */
window.openEditModal = function(id) {
  const p = allProducts.find(item => item.id === id);
  if (!p) return;

  editingProductId = id;
  document.getElementById('modal-title').textContent = 'Edit Product';
  document.getElementById('modal-error').style.display = 'none';

  document.getElementById('prod-name').value = p.name;
  document.getElementById('prod-category').value = p.category || '';
  document.getElementById('prod-price').value = p.price;
  document.getElementById('prod-gst').value = p.gst_percent || 0;
  document.getElementById('prod-stock').value = p.stock_qty || 0;
  document.getElementById('prod-limit').value = p.low_stock_limit || 5;

  document.getElementById('product-modal').classList.add('active');
};

/**
 * Close Product Modal
 */
window.closeProductModal = function() {
  document.getElementById('product-modal').classList.remove('active');
};

/**
 * Handle Add/Edit Form Submission
 */
async function handleFormSubmit(e) {
  e.preventDefault();
  const errorBox = document.getElementById('modal-error');
  errorBox.style.display = 'none';

  const name = document.getElementById('prod-name').value.trim();
  const category = document.getElementById('prod-category').value.trim();
  const price = parseFloat(document.getElementById('prod-price').value);
  const gst_percent = parseFloat(document.getElementById('prod-gst').value) || 0;
  const stock_qty = parseInt(document.getElementById('prod-stock').value, 10) || 0;
  const low_stock_limit = parseInt(document.getElementById('prod-limit').value, 10) || 5;

  if (!name || isNaN(price) || price < 0) {
    errorBox.textContent = 'Please provide a valid product name and non-negative price.';
    errorBox.style.display = 'block';
    return;
  }

  const payload = {
    name,
    category: category || 'General',
    price,
    gst_percent,
    stock_qty,
    low_stock_limit
  };

  try {
    let res;
    if (editingProductId) {
      res = await api.put(`/products/${editingProductId}`, payload);
    } else {
      res = await api.post('/products', payload);
    }

    if (res.success) {
      closeProductModal();
      await fetchProducts();
    } else {
      errorBox.textContent = res.message || 'Failed to save product.';
      errorBox.style.display = 'block';
    }
  } catch (err) {
    errorBox.textContent = err.message || 'Network error.';
    errorBox.style.display = 'block';
  }
}

/**
 * Delete product confirmation modal
 */
window.openDeleteModal = function(id, name) {
  productToDeleteId = id;
  document.getElementById('delete-prod-name').textContent = name;
  document.getElementById('delete-modal').classList.add('active');
};

window.closeDeleteModal = function() {
  productToDeleteId = null;
  document.getElementById('delete-modal').classList.remove('active');
};

window.confirmDeleteProduct = async function() {
  if (!productToDeleteId) return;

  try {
    const res = await api.delete(`/products/${productToDeleteId}`);
    if (res.success) {
      closeDeleteModal();
      await fetchProducts();
    } else {
      alert(res.message || 'Failed to delete product.');
    }
  } catch (err) {
    alert('Delete error: ' + err.message);
  }
};

/**
 * Bind Search and Filter events
 */
function bindProductEvents() {
  const searchInput = document.getElementById('search-input');
  const catFilter = document.getElementById('category-filter');
  const form = document.getElementById('product-form');

  if (searchInput) searchInput.addEventListener('input', fetchProducts);
  if (catFilter) catFilter.addEventListener('change', fetchProducts);
  if (form) form.addEventListener('submit', handleFormSubmit);
}
