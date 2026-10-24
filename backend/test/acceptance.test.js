const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('http');
const app = require('../src/app');

// Helper to make HTTP requests against express app
function makeRequest(server, path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = request.request(
      {
        hostname: 'localhost',
        port: address.port,
        path,
        method,
        headers
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(rawData);
            resolve({ status: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, raw: rawData });
          }
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

test('Acceptance Checklist Demo Flow (Section 13)', async (t) => {
  const server = app.listen(0);

  try {
    // 1. Log in
    const loginRes = await makeRequest(server, '/api/auth/login', 'POST', {
      email: 'admin@shop.com',
      password: 'admin123'
    });
    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.data.success, true);
    const token = loginRes.data.data.token;
    assert.ok(token, 'JWT Token must be returned');

    // 2. Add a product with stock 20 and GST 5%
    const addProdRes = await makeRequest(
      server,
      '/api/products',
      'POST',
      {
        name: 'Demo Organic Tea (250g)',
        category: 'Beverages',
        price: 150.00,
        gst_percent: 5.00,
        stock_qty: 20,
        low_stock_limit: 5
      },
      token
    );
    assert.equal(addProdRes.status, 201);
    const newProduct = addProdRes.data.data;
    assert.equal(newProduct.stock_qty, 20);
    assert.equal(newProduct.gst_percent, 5);

    // 3. Create a customer
    const addCustRes = await makeRequest(
      server,
      '/api/customers',
      'POST',
      {
        name: 'Karan Mehra',
        phone: '9898989898',
        address: 'Sector 15, Vashi, Navi Mumbai'
      },
      token
    );
    assert.equal(addCustRes.status, 201);
    const customer = addCustRes.data.data;
    assert.ok(customer.id);

    // 4. Create a bill with discount and partial payment. Status shows PARTIAL
    // Product 150 x 2 = 300. Discount = 20. Taxable = 280.
    // 5% GST on 280 = 14. Total = 294.
    // Paid = 100. Pending = 194. Status = PARTIAL.
    const createBillRes = await makeRequest(
      server,
      '/api/bills',
      'POST',
      {
        customer_id: customer.id,
        items: [
          {
            product_id: newProduct.id,
            qty: 2,
            rate: 150.00,
            gst_percent: 5.00
          }
        ],
        discount: 20.00,
        amount_paid: 100.00,
        payment_mode: 'CASH'
      },
      token
    );
    assert.equal(createBillRes.status, 201);
    const bill = createBillRes.data.data;
    assert.equal(bill.subtotal, 300.00);
    assert.equal(bill.discount, 20.00);
    assert.equal(bill.tax, 14.00);
    assert.equal(bill.total_amount, 294.00);
    assert.equal(bill.amount_paid, 100.00);
    assert.equal(bill.amount_pending, 194.00);
    assert.equal(bill.status, 'PARTIAL');

    // Verify stock reduced from 20 to 18
    const checkProdRes = await makeRequest(server, `/api/products/${newProduct.id}`, 'GET', null, token);
    assert.equal(checkProdRes.data.data.stock_qty, 18);

    // 5. Open customer's ledger: bill appears, summary shows correct billed, paid, pending
    const ledgerSumRes = await makeRequest(server, `/api/customers/${customer.id}/summary`, 'GET', null, token);
    assert.equal(ledgerSumRes.status, 200);
    assert.equal(ledgerSumRes.data.data.total_billed, 294.00);
    assert.equal(ledgerSumRes.data.data.total_paid, 100.00);
    assert.equal(ledgerSumRes.data.data.total_pending, 194.00);

    // 6. Add payment for remaining amount (194). Bill status becomes PAID, customer balance becomes 0
    const payRemainingRes = await makeRequest(
      server,
      '/api/payments',
      'POST',
      {
        customer_id: customer.id,
        bill_id: bill.id,
        amount: 194.00,
        mode: 'UPI',
        note: 'Settled remaining dues'
      },
      token
    );
    assert.equal(payRemainingRes.status, 201);

    // Check bill updated to PAID
    const checkBillRes = await makeRequest(server, `/api/bills/${bill.id}`, 'GET', null, token);
    assert.equal(checkBillRes.data.data.status, 'PAID');
    assert.equal(checkBillRes.data.data.amount_pending, 0);

    // Check customer pending balance is 0
    const checkCustRes = await makeRequest(server, `/api/customers/${customer.id}`, 'GET', null, token);
    assert.equal(Number(checkCustRes.data.data.pending_balance), 0);

    // 7. Statement data returns successfully
    const statementRes = await makeRequest(server, `/api/customers/${customer.id}/statement`, 'GET', null, token);
    assert.equal(statementRes.status, 200);
    assert.ok(statementRes.data.data.bills.length > 0);
    assert.ok(statementRes.data.data.payments.length > 0);

    // 8. Edit bill (change quantity from 2 to 3, re-calculate, adjust stock in transaction)
    const editBillRes = await makeRequest(
      server,
      `/api/bills/${bill.id}`,
      'PUT',
      {
        items: [
          {
            product_id: newProduct.id,
            qty: 3, // Increased from 2 to 3
            rate: 150.00,
            gst_percent: 5.00
          }
        ],
        discount: 20.00,
        amount_paid: 294.00, // Total already paid: 100 + 194
        payment_mode: 'UPI'
      },
      token
    );
    assert.equal(editBillRes.status, 200);
    // Subtotal: 3 * 150 = 450. Discount = 20. Taxable = 430.
    // 5% GST = 21.50. Total = 451.50.
    // Paid = 294. Pending = 157.50. Status = PARTIAL.
    assert.equal(editBillRes.data.data.total_amount, 451.50);
    assert.equal(editBillRes.data.data.amount_pending, 157.50);
    assert.equal(editBillRes.data.data.status, 'PARTIAL');

    // Verify stock adjusted correctly: original 20 - 3 = 17
    const checkStockAfterEdit = await makeRequest(server, `/api/products/${newProduct.id}`, 'GET', null, token);
    assert.equal(checkStockAfterEdit.data.data.stock_qty, 17);

    // 9. Dashboard shows metrics
    const dashRes = await makeRequest(server, '/api/reports/dashboard', 'GET', null, token);
    assert.equal(dashRes.status, 200);
    assert.ok(dashRes.data.data.today_sales !== undefined);
  } finally {
    server.close();
  }
});
