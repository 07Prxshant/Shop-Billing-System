/**
 * Print & PDF Statement Formatter (Vanilla JS)
 * Formats invoices and statements for direct browser printing and saving as PDF.
 */

/**
 * Print Tax Invoice
 */
async function printInvoice(billId) {
  try {
    const [billRes, settingsRes] = await Promise.all([
      api.get(`/bills/${billId}`),
      api.get('/settings')
    ]);

    if (!billRes.success || !billRes.data) {
      alert('Unable to retrieve bill data for printing.');
      return;
    }

    const bill = billRes.data;
    const settings = settingsRes.data || {};

    const shopName = settings.shop_name || 'Vikas Super Market';
    const shopAddress = settings.address || '124 Main Street, Commercial Hub, Mumbai';
    const shopPhone = settings.phone || '022-28471920';
    const gstNo = settings.gst_number || 'GSTIN27AABCU9603R1ZM';
    const footerText = settings.invoice_footer || 'Thank you for shopping with us! Visit again.';

    // Generate printable HTML
    let itemsRows = '';
    (bill.items || []).forEach((item, index) => {
      itemsRows += `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${index + 1}</td>
          <td style="border: 1px solid #ddd; padding: 8px;"><strong>${item.product_name}</strong></td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">Rs. ${Number(item.rate).toFixed(2)}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.qty}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.gst_percent || 0}%</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">Rs. ${Number(item.amount).toFixed(2)}</td>
        </tr>
      `;
    });

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice ${bill.bill_no}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 20px; color: #1e293b; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
          .shop-title { font-size: 24px; font-weight: 900; margin: 0; color: #0f172a; }
          .shop-sub { font-size: 12px; color: #64748b; margin-top: 4px; }
          .invoice-tag { font-size: 14px; font-weight: 800; color: #4f46e5; letter-spacing: 1px; margin-top: 8px; }
          .meta-grid { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px; line-height: 1.5; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
          th { background-color: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; text-align: left; text-transform: uppercase; font-size: 11px; }
          .totals-table { width: 300px; margin-left: auto; font-size: 13px; margin-bottom: 20px; }
          .totals-table td { padding: 4px 8px; }
          .footer-note { text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 12px; font-size: 11px; color: #64748b; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="shop-title">${shopName}</h1>
          <div class="shop-sub">${shopAddress}</div>
          <div class="shop-sub">Phone: ${shopPhone} | GSTIN: ${gstNo}</div>
          <div class="invoice-tag">TAX INVOICE / CASH MEMO</div>
        </div>

        <div class="meta-grid">
          <div>
            <strong>Billed To:</strong><br>
            ${bill.customer_name || 'Walk-in Customer'}<br>
            ${bill.customer_phone ? 'Phone: ' + bill.customer_phone + '<br>' : ''}
            ${bill.customer_address ? 'Address: ' + bill.customer_address : ''}
          </div>
          <div style="text-align: right;">
            <strong>Invoice No:</strong> ${bill.bill_no}<br>
            <strong>Date:</strong> ${formatDate(bill.bill_date)}<br>
            <strong>Mode:</strong> ${bill.payment_mode || 'CASH'}<br>
            <strong>Status:</strong> ${bill.status}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">#</th>
              <th>Description of Goods</th>
              <th style="text-align: right;">Rate</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: center;">GST %</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <table class="totals-table">
          <tr>
            <td>Subtotal:</td>
            <td style="text-align: right;">Rs. ${Number(bill.subtotal || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td>Discount:</td>
            <td style="text-align: right;">Rs. ${Number(bill.discount || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td>GST Tax:</td>
            <td style="text-align: right;">Rs. ${Number(bill.tax || 0).toFixed(2)}</td>
          </tr>
          <tr style="border-top: 2px solid #0f172a; font-weight: 900; font-size: 15px;">
            <td>Total Amount:</td>
            <td style="text-align: right;">Rs. ${Number(bill.total_amount || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td>Amount Paid:</td>
            <td style="text-align: right; color: #16a34a; font-weight: 700;">Rs. ${Number(bill.amount_paid || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td>Pending Due:</td>
            <td style="text-align: right; color: #dc2626; font-weight: 700;">Rs. ${Number(bill.amount_pending || 0).toFixed(2)}</td>
          </tr>
        </table>

        ${bill.notes ? `<div style="font-size: 12px; margin-bottom: 20px;"><strong>Remarks:</strong> ${bill.notes}</div>` : ''}

        <div class="footer-note">
          "${footerText}"
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank', 'width=800,height=700');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(printHtml);
      printWin.document.close();
    } else {
      alert('Popup blocker prevented print window from opening. Please allow popups for this site.');
    }
  } catch (err) {
    alert('Error generating printable invoice: ' + err.message);
  }
}

/**
 * Print Customer Statement
 */
async function printCustomerStatement(customerId, from, to) {
  try {
    const res = await api.get(`/customers/${customerId}/statement`, { from, to });
    if (!res.success || !res.data) {
      alert('Unable to load statement.');
      return;
    }

    const { customer, settings, period, bills, payments, summary } = res.data;

    let billsRows = '';
    (bills || []).forEach(b => {
      billsRows += `
        <tr>
          <td style="border: 1px solid #ddd; padding: 6px;">${b.bill_no}</td>
          <td style="border: 1px solid #ddd; padding: 6px;">${formatDate(b.bill_date)}</td>
          <td style="border: 1px solid #ddd; padding: 6px; text-align: right;">Rs. ${Number(b.total_amount).toFixed(2)}</td>
          <td style="border: 1px solid #ddd; padding: 6px; text-align: right;">Rs. ${Number(b.amount_paid).toFixed(2)}</td>
          <td style="border: 1px solid #ddd; padding: 6px; text-align: right;">Rs. ${Number(b.amount_pending).toFixed(2)}</td>
          <td style="border: 1px solid #ddd; padding: 6px; text-align: center;">${b.status}</td>
        </tr>
      `;
    });

    let paymentsRows = '';
    (payments || []).forEach(p => {
      paymentsRows += `
        <tr>
          <td style="border: 1px solid #ddd; padding: 6px;">${formatDate(p.payment_date)}</td>
          <td style="border: 1px solid #ddd; padding: 6px; text-align: right;">Rs. ${Number(p.amount).toFixed(2)}</td>
          <td style="border: 1px solid #ddd; padding: 6px;">${p.mode || 'CASH'}</td>
          <td style="border: 1px solid #ddd; padding: 6px;">${p.bill_no || 'On Account'}</td>
          <td style="border: 1px solid #ddd; padding: 6px;">${p.note || '-'}</td>
        </tr>
      `;
    });

    const statementHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Customer Statement - ${customer.name}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 20px; color: #1e293b; font-size: 13px; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
          .shop-title { font-size: 22px; font-weight: 900; margin: 0; }
          .statement-title { font-size: 15px; font-weight: 800; color: #4f46e5; margin-top: 8px; }
          .meta-box { background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
          th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px; text-align: left; }
          .summary-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="shop-title">${settings.shop_name || 'Vikas Super Market'}</h1>
          <div>${settings.address || ''} | Phone: ${settings.phone || ''}</div>
          <div class="statement-title">CUSTOMER ACCOUNT STATEMENT</div>
          <div style="font-size: 12px; color: #64748b;">Period: ${formatDate(period.from)} to ${formatDate(period.to)}</div>
        </div>

        <div class="meta-box">
          <div>
            <strong>Customer:</strong> ${customer.name}<br>
            <strong>Phone:</strong> ${customer.phone || 'N/A'}<br>
            <strong>Address:</strong> ${customer.address || 'N/A'}
          </div>
          <div style="text-align: right;">
            <strong>Total Invoiced:</strong> Rs. ${Number(summary.total_billed).toFixed(2)}<br>
            <strong>Total Payments:</strong> Rs. ${Number(summary.total_paid).toFixed(2)}<br>
            <strong style="color: #dc2626;">Closing Balance:</strong> Rs. ${Number(summary.closing_balance).toFixed(2)}
          </div>
        </div>

        <h3>Invoices Issued</h3>
        <table>
          <thead>
            <tr>
              <th>Invoice No</th>
              <th>Date</th>
              <th style="text-align: right;">Total</th>
              <th style="text-align: right;">Paid</th>
              <th style="text-align: right;">Pending</th>
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${billsRows || '<tr><td colspan="6" style="text-align:center; padding: 8px;">No invoices in this period.</td></tr>'}
          </tbody>
        </table>

        <h3>Payments Received</h3>
        <table>
          <thead>
            <tr>
              <th>Payment Date</th>
              <th style="text-align: right;">Amount</th>
              <th>Mode</th>
              <th>Applied To</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${paymentsRows || '<tr><td colspan="5" style="text-align:center; padding: 8px;">No payments recorded in this period.</td></tr>'}
          </tbody>
        </table>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank', 'width=800,height=700');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(statementHtml);
      printWin.document.close();
    } else {
      alert('Popup blocker prevented print window from opening. Please allow popups for this site.');
    }
  } catch (err) {
    alert('Error printing statement: ' + err.message);
  }
}
