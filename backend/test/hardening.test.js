process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('http');
const app = require('../src/app');
const { getJwtSecret, KNOWN_INSECURE_SECRETS } = require('../src/config/jwt');
const { updateBill } = require('../src/services/billService');
const db = require('../src/config/db');

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

// -------------------------------------------------------------
// SEC-01 Tests: JWT validation and production security
// -------------------------------------------------------------
test('SEC-01: Rejects weak, short, or placeholder JWT_SECRET in strict mode', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalStrict = process.env.STRICT_SECURITY;
  const originalSecret = process.env.JWT_SECRET;

  try {
    process.env.NODE_ENV = 'production';
    process.env.STRICT_SECURITY = 'true';

    // 1. Missing secret
    delete process.env.JWT_SECRET;
    assert.throws(() => getJwtSecret(), /Production deployment blocked: JWT_SECRET environment variable is missing/);

    // 2. Known placeholder secret
    for (const weak of KNOWN_INSECURE_SECRETS) {
      process.env.JWT_SECRET = weak;
      assert.throws(() => getJwtSecret(), /Production deployment blocked: JWT_SECRET matches a known insecure demo placeholder/);
    }

    // 3. Too short (< 32 chars)
    process.env.JWT_SECRET = 'short_secret_12345';
    assert.throws(() => getJwtSecret(), /Production deployment blocked: JWT_SECRET is too short/);

    // 4. Valid 32+ character cryptographically random secret
    process.env.JWT_SECRET = 'a7d8e9f0c1b234567890abcdef1234567890abcdef1234567890abcdef12';
    assert.doesNotThrow(() => getJwtSecret());
  } finally {
    process.env.NODE_ENV = originalEnv;
    if (originalStrict) process.env.STRICT_SECURITY = originalStrict;
    else delete process.env.STRICT_SECURITY;
    if (originalSecret) process.env.JWT_SECRET = originalSecret;
    else delete process.env.JWT_SECRET;
  }
});

test('SEC-01: Demo credentials allow authentication with admin@shop.com and admin123', async () => {
  const server = app.listen(0);

  try {
    // Correct demo credentials succeed
    const res = await makeRequest(server, '/api/auth/login', 'POST', {
      email: 'admin@shop.com',
      password: 'admin123'
    });
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.ok(res.data.data.token);

    // Incorrect password rejected
    const badRes = await makeRequest(server, '/api/auth/login', 'POST', {
      email: 'admin@shop.com',
      password: 'wrong_password_123'
    });
    assert.equal(badRes.status, 401);
    assert.equal(badRes.data.success, false);
  } finally {
    server.close();
  }
});

// -------------------------------------------------------------
// OPS-01 Tests: Database health endpoint and production fail-fast
// -------------------------------------------------------------
test('OPS-01: /api/health and /health report database connectivity without leaking credentials', async () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  const server = app.listen(0);

  try {
    const res = await makeRequest(server, '/api/health', 'GET');
    assert.equal(res.status, 200);
    assert.equal(res.data.success, true);
    assert.equal(res.data.status, 'healthy');
    assert.ok(res.data.database.connected);
    assert.ok(res.data.database.driver);
    // Ensure no secrets/hosts/passwords are leaked
    const jsonStr = JSON.stringify(res.data);
    assert.equal(jsonStr.includes('password'), false);
    assert.equal(jsonStr.includes('JWT_SECRET'), false);
  } finally {
    process.env.NODE_ENV = originalEnv || 'test';
    server.close();
  }
});

test('OPS-01: In-memory fallback fails fast when STRICT_DB is enabled', async () => {
  const originalEnv = process.env.NODE_ENV;
  const originalStrict = process.env.STRICT_DB;

  try {
    process.env.NODE_ENV = 'production';
    process.env.STRICT_DB = 'true';

    const mysql = require('mysql2/promise');
    const origCreatePool = mysql.createPool;
    mysql.createPool = () => ({
      getConnection: async () => {
        throw new Error('ECONNREFUSED 127.0.0.1:3306');
      }
    });

    try {
      await assert.rejects(
        async () => {
          await db.initDB();
        },
        /In-memory fallback is disabled by STRICT_DB/
      );
    } finally {
      mysql.createPool = origCreatePool;
    }
  } finally {
    process.env.NODE_ENV = originalEnv;
    if (originalStrict) process.env.STRICT_DB = originalStrict;
    else delete process.env.STRICT_DB;
  }
});

// -------------------------------------------------------------
// BUG-02 Tests: Bill editing and payment consistency
// -------------------------------------------------------------
test('BUG-02: Editing an UNPAID bill preserves zero paid and recalculates new total', async () => {
  const server = app.listen(0);

  try {
    const loginRes = await makeRequest(server, '/api/auth/login', 'POST', {
      email: 'admin@shop.com',
      password: 'admin123'
    });
    const token = loginRes.data.data.token;

    // Create a customer
    const custRes = await makeRequest(server, '/api/customers', 'POST', {
      name: 'Unpaid Test Customer',
      phone: '9111111111',
      address: 'Test Address'
    }, token);
    const customer = custRes.data.data;

    // Create an unpaid bill: 2 * 110 (prod 1) = 220 + 5% GST (11) = 231
    const billRes = await makeRequest(server, '/api/bills', 'POST', {
      customer_id: customer.id,
      items: [{ product_id: 10, qty: 2, rate: 110, gst_percent: 5 }],
      discount: 0,
      amount_paid: 0,
      payment_mode: 'CREDIT'
    }, token);
    const bill = billRes.data.data;
    assert.equal(bill.total_amount, 231);
    assert.equal(bill.amount_paid, 0);
    assert.equal(bill.amount_pending, 231);
    assert.equal(bill.status, 'UNPAID');

    // Edit unpaid bill: increase qty from 2 to 3 -> total: 3 * 110 = 330 + 5% (16.50) = 346.50
    const editRes = await makeRequest(server, `/api/bills/${bill.id}`, 'PUT', {
      items: [{ product_id: 10, qty: 3, rate: 110, gst_percent: 5 }],
      discount: 0,
      payment_mode: 'CREDIT'
    }, token);
    assert.equal(editRes.status, 200);
    assert.equal(editRes.data.data.total_amount, 346.50);
    assert.equal(editRes.data.data.amount_paid, 0);
    assert.equal(editRes.data.data.amount_pending, 346.50);
    assert.equal(editRes.data.data.status, 'UNPAID');
  } finally {
    server.close();
  }
});

test('BUG-02: Editing a PARTIALLY paid bill keeps payments reconciled and updates status', async () => {
  const server = app.listen(0);

  try {
    const loginRes = await makeRequest(server, '/api/auth/login', 'POST', {
      email: 'admin@shop.com',
      password: 'admin123'
    });
    const token = loginRes.data.data.token;

    // Create a customer
    const custRes = await makeRequest(server, '/api/customers', 'POST', {
      name: 'Partial Test Customer',
      phone: '9222222222',
      address: 'Test Address'
    }, token);
    const customer = custRes.data.data;

    // Create bill: 2 * 110 = 220 + 5% = 231. Initial payment = 100
    const billRes = await makeRequest(server, '/api/bills', 'POST', {
      customer_id: customer.id,
      items: [{ product_id: 10, qty: 2, rate: 110, gst_percent: 5 }],
      discount: 0,
      amount_paid: 100,
      payment_mode: 'CASH'
    }, token);
    const bill = billRes.data.data;
    assert.equal(bill.amount_paid, 100);
    assert.equal(bill.status, 'PARTIAL');

    // Edit bill: increase items so new total is 346.50, without passing amount_paid.
    // Must preserve recorded payment of 100!
    const editRes = await makeRequest(server, `/api/bills/${bill.id}`, 'PUT', {
      items: [{ product_id: 10, qty: 3, rate: 110, gst_percent: 5 }],
      discount: 0,
      payment_mode: 'CASH'
    }, token);
    assert.equal(editRes.status, 200);
    assert.equal(editRes.data.data.total_amount, 346.50);
    assert.equal(editRes.data.data.amount_paid, 100);
    assert.equal(editRes.data.data.amount_pending, 246.50);
    assert.equal(editRes.data.data.status, 'PARTIAL');

    // Customer ledger statement reflects 100 paid and 246.50 pending
    const ledgerRes = await makeRequest(server, `/api/customers/${customer.id}/summary`, 'GET', null, token);
    assert.equal(ledgerRes.data.data.total_billed, 346.50);
    assert.equal(ledgerRes.data.data.total_paid, 100);
    assert.equal(ledgerRes.data.data.total_pending, 246.50);
  } finally {
    server.close();
  }
});

test('BUG-02: Editing a FULLY paid bill reconciles payments and updates status', async () => {
  const server = app.listen(0);

  try {
    const loginRes = await makeRequest(server, '/api/auth/login', 'POST', {
      email: 'admin@shop.com',
      password: 'admin123'
    });
    const token = loginRes.data.data.token;

    // Create a customer
    const custRes = await makeRequest(server, '/api/customers', 'POST', {
      name: 'Fully Paid Test Customer',
      phone: '9333333333',
      address: 'Test Address'
    }, token);
    const customer = custRes.data.data;

    // Create bill: 1 * 110 = 110 + 5% = 115.50. Paid in full: 115.50
    const billRes = await makeRequest(server, '/api/bills', 'POST', {
      customer_id: customer.id,
      items: [{ product_id: 10, qty: 1, rate: 110, gst_percent: 5 }],
      discount: 0,
      amount_paid: 115.50,
      payment_mode: 'UPI'
    }, token);
    const bill = billRes.data.data;
    assert.equal(bill.status, 'PAID');
    assert.equal(bill.amount_pending, 0);

    // Edit bill: Add an item so total becomes 231.
    // If user does not provide extra payment, bill transitions to PARTIAL with 115.50 pending!
    const editRes = await makeRequest(server, `/api/bills/${bill.id}`, 'PUT', {
      items: [{ product_id: 10, qty: 2, rate: 110, gst_percent: 5 }],
      discount: 0,
      payment_mode: 'UPI'
    }, token);
    assert.equal(editRes.status, 200);
    assert.equal(editRes.data.data.total_amount, 231);
    assert.equal(editRes.data.data.amount_paid, 115.50);
    assert.equal(editRes.data.data.amount_pending, 115.50);
    assert.equal(editRes.data.data.status, 'PARTIAL');

    // Customer ledger statement verifies payment history sum is still exactly 115.50
    const stmtRes = await makeRequest(server, `/api/customers/${customer.id}/statement`, 'GET', null, token);
    const paymentsSum = stmtRes.data.data.payments.reduce((acc, p) => acc + Number(p.amount), 0);
    assert.equal(paymentsSum, 115.50);
  } finally {
    server.close();
  }
});

test('BUG-02: Rejects bill edit if requested amount_paid exceeds bill total', async () => {
  const server = app.listen(0);

  try {
    const loginRes = await makeRequest(server, '/api/auth/login', 'POST', {
      email: 'admin@shop.com',
      password: 'admin123'
    });
    const token = loginRes.data.data.token;

    // Create a customer
    const custRes = await makeRequest(server, '/api/customers', 'POST', {
      name: 'Overpay Test Customer',
      phone: '9444444444',
      address: 'Test Address'
    }, token);
    const customer = custRes.data.data;

    // Create bill
    const billRes = await makeRequest(server, '/api/bills', 'POST', {
      customer_id: customer.id,
      items: [{ product_id: 10, qty: 1, rate: 110, gst_percent: 5 }],
      discount: 0,
      amount_paid: 0,
      payment_mode: 'CREDIT'
    }, token);
    const bill = billRes.data.data;

    // Attempt to edit with amount_paid = 500 when total is 115.50
    const editRes = await makeRequest(server, `/api/bills/${bill.id}`, 'PUT', {
      items: [{ product_id: 10, qty: 1, rate: 110, gst_percent: 5 }],
      discount: 0,
      amount_paid: 500,
      payment_mode: 'CASH'
    }, token);

    assert.notEqual(editRes.status, 200);
    assert.match(editRes.data.message, /cannot exceed total bill amount/i);
  } finally {
    server.close();
  }
});

// -------------------------------------------------------------
// BUG-01 Tests: Session verification auth contract
// -------------------------------------------------------------
test('BUG-01: /api/auth/me returns 200 with valid session token', async () => {
  const server = app.listen(0);

  try {
    const loginRes = await makeRequest(server, '/api/auth/login', 'POST', {
      email: 'admin@shop.com',
      password: 'admin123'
    });
    const token = loginRes.data.data.token;

    const meRes = await makeRequest(server, '/api/auth/me', 'GET', null, token);
    assert.equal(meRes.status, 200);
    assert.equal(meRes.data.success, true);
    assert.equal(meRes.data.data.email, 'admin@shop.com');
  } finally {
    server.close();
  }
});

test('BUG-01: /api/auth/me explicitly returns 401 on invalid/expired token so frontend clears session only when verified invalid', async () => {
  const server = app.listen(0);

  try {
    // 1. Missing token
    const noTokenRes = await makeRequest(server, '/api/auth/me', 'GET');
    assert.equal(noTokenRes.status, 401);
    assert.equal(noTokenRes.data.success, false);

    // 2. Tampered / invalid token
    const invalidTokenRes = await makeRequest(server, '/api/auth/me', 'GET', null, 'invalid.bearer.jwt.token');
    assert.equal(invalidTokenRes.status, 401);
    assert.equal(invalidTokenRes.data.success, false);
  } finally {
    server.close();
  }
});

// -------------------------------------------------------------
// CLAUDE-BUG-01 & BUG-02: Embedded Fallback Query Routing & Filtering
// -------------------------------------------------------------
test('CLAUDE-BUG-01: GET /api/bills and customer transactions are not swallowed by sales chart handler', async () => {
  const server = app.listen(0);

  try {
    const loginRes = await makeRequest(server, '/api/auth/login', 'POST', {
      email: 'admin@shop.com',
      password: 'admin123'
    });
    const token = loginRes.data.data.token;

    // 1. GET /api/bills must return an array of actual bill objects, not sales chart { label, total, count }
    const billsRes = await makeRequest(server, '/api/bills', 'GET', null, token);
    assert.equal(billsRes.status, 200);
    assert.equal(billsRes.data.success, true);
    assert.ok(Array.isArray(billsRes.data.data));
    assert.ok(billsRes.data.data.length > 0);
    const firstBill = billsRes.data.data[0];
    assert.ok(firstBill.bill_no, 'Bill object must have bill_no');
    assert.ok(firstBill.total_amount !== undefined, 'Bill object must have total_amount');
    assert.equal(firstBill.label, undefined, 'Bill object should not be a chart data group with label');

    // 2. GET /api/customers/2/transactions must return customer transactions with bill details
    const txRes = await makeRequest(server, '/api/customers/2/transactions', 'GET', null, token);
    assert.equal(txRes.status, 200);
    assert.equal(txRes.data.success, true);
    assert.ok(Array.isArray(txRes.data.data));
    if (txRes.data.data.length > 0) {
      const firstTx = txRes.data.data[0];
      assert.ok(firstTx.bill_no || firstTx.id, 'Transaction must contain bill identifier');
      assert.equal(firstTx.label, undefined, 'Transaction should not be a chart object');
    }
  } finally {
    server.close();
  }
});

test('CLAUDE-BUG-02: GET /api/bills accurately applies customerId and status query parameters', async () => {
  const server = app.listen(0);

  try {
    const loginRes = await makeRequest(server, '/api/auth/login', 'POST', {
      email: 'admin@shop.com',
      password: 'admin123'
    });
    const token = loginRes.data.data.token;

    // Filter by customerId = 2
    const custBillsRes = await makeRequest(server, '/api/bills?customerId=2', 'GET', null, token);
    assert.equal(custBillsRes.status, 200);
    assert.ok(Array.isArray(custBillsRes.data.data));
    for (const b of custBillsRes.data.data) {
      assert.equal(b.customer_id, 2);
    }

    // Filter by status = PAID
    const paidBillsRes = await makeRequest(server, '/api/bills?status=PAID', 'GET', null, token);
    assert.equal(paidBillsRes.status, 200);
    assert.ok(Array.isArray(paidBillsRes.data.data));
    for (const b of paidBillsRes.data.data) {
      assert.equal(b.status, 'PAID');
    }
  } finally {
    server.close();
  }
});

// -------------------------------------------------------------
// CLAUDE-BUG-03: Test suite isolation from .demo_db.json
// -------------------------------------------------------------
test('CLAUDE-BUG-03: Running tests does not persist or write to .demo_db.json on disk', () => {
  const fs = require('fs');
  const path = require('path');
  const diskPath = path.join(__dirname, '../.demo_db.json');
  assert.equal(fs.existsSync(diskPath), false, '.demo_db.json should not exist on disk after test execution');
});
