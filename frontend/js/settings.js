/**
 * Shop Settings Controller (Vanilla JS)
 * Manages shop profile, GSTIN credentials, and invoice footer message.
 */

document.addEventListener('DOMContentLoaded', async () => {
  await loadShopSettings();

  const form = document.getElementById('settings-form');
  if (form) form.addEventListener('submit', handleSettingsSubmit);

  // Live preview updates
  ['shop-name', 'shop-address', 'shop-phone', 'shop-gst', 'shop-footer'].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.addEventListener('input', updateInvoicePreview);
  });
});

/**
 * Load settings from API
 */
async function loadShopSettings() {
  const loading = document.getElementById('settings-loading');
  const form = document.getElementById('settings-form');

  try {
    const res = await api.get('/settings');
    if (res.success && res.data) {
      const s = res.data;
      document.getElementById('shop-name').value = s.shop_name || '';
      document.getElementById('shop-address').value = s.address || '';
      document.getElementById('shop-phone').value = s.phone || '';
      document.getElementById('shop-gst').value = s.gst_number || '';
      document.getElementById('shop-footer').value = s.invoice_footer || '';

      updateInvoicePreview();

      if (loading) loading.style.display = 'none';
      if (form) form.style.display = 'block';
    }
  } catch (err) {
    alert('Failed to load settings: ' + err.message);
  }
}

/**
 * Update live header preview box
 */
function updateInvoicePreview() {
  const name = document.getElementById('shop-name')?.value || 'Shop Name';
  const addr = document.getElementById('shop-address')?.value || 'Shop Address';
  const phone = document.getElementById('shop-phone')?.value || 'Phone Number';
  const gst = document.getElementById('shop-gst')?.value || 'GSTIN';
  const footer = document.getElementById('shop-footer')?.value || '';

  const previewName = document.getElementById('prev-shop-name');
  const previewDetails = document.getElementById('prev-shop-details');
  const previewFooter = document.getElementById('prev-shop-footer');

  if (previewName) previewName.textContent = name;
  if (previewDetails) previewDetails.textContent = `${addr} | Phone: ${phone} | GSTIN: ${gst}`;
  if (previewFooter) previewFooter.textContent = footer ? `"${footer}"` : '';
}

/**
 * Save settings to API
 */
async function handleSettingsSubmit(e) {
  e.preventDefault();
  const alertBox = document.getElementById('settings-alert');
  const submitBtn = document.getElementById('save-settings-btn');

  alertBox.style.display = 'none';

  const payload = {
    shop_name: document.getElementById('shop-name').value.trim(),
    address: document.getElementById('shop-address').value.trim(),
    phone: document.getElementById('shop-phone').value.trim(),
    gst_number: document.getElementById('shop-gst').value.trim(),
    invoice_footer: document.getElementById('shop-footer').value.trim()
  };

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
    }

    const res = await api.put('/settings', payload);
    if (res.success) {
      alertBox.textContent = '✓ Shop settings updated successfully! Your invoices will now use these credentials.';
      alertBox.className = 'alert alert-success';
      alertBox.style.display = 'block';
    } else {
      throw new Error(res.message || 'Save failed.');
    }
  } catch (err) {
    alertBox.textContent = '⚠️ ' + (err.message || 'Error saving settings.');
    alertBox.className = 'alert alert-danger';
    alertBox.style.display = 'block';
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Settings';
    }
  }
}
