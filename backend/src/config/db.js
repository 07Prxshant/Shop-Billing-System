const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const connectionUri = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.MYSQL_PRIVATE_URL;

const dbConfig = connectionUri ? {
  uri: connectionUri,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  multipleStatements: true
} : {
  host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
  user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (process.env.MYSQLPASSWORD || ''),
  database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'shop_billing',
  port: parseInt(process.env.DB_PORT || process.env.MYSQLPORT, 10) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  multipleStatements: true
};

let pool = null;
let isUsingFallback = false;
let fallbackStore = null;

// Built-in fallback database for development/demonstrations when MySQL is offline
function initializeFallbackStore() {
  if (fallbackStore) return fallbackStore;

  // Initial seed state
  fallbackStore = {
    users: [
      {
        id: 1,
        name: 'Shop Admin',
        email: 'admin@shop.com',
        // password: admin123
        password_hash: '$2a$10$0H75Ov88HvNJ10imCpY.6uhVXPEyAMvc83aPB5M9z0ijijc0cIzRW',
        role: 'admin',
        created_at: new Date().toISOString()
      }
    ],
    customers: [
      { id: 1, name: 'Walk-in', phone: '0000000000', address: 'Direct Counter Sales', is_deleted: 0, created_at: new Date().toISOString() },
      { id: 2, name: 'Rahul Sharma', phone: '9876543210', address: 'Flat 101, Sunshine Heights, Mumbai', is_deleted: 0, created_at: new Date().toISOString() },
      { id: 3, name: 'Priya Patel', phone: '9823456789', address: 'B-12, Green Park Society, Pune', is_deleted: 0, created_at: new Date().toISOString() },
      { id: 4, name: 'Amit Verma', phone: '9123456780', address: 'Shop 4, Market Yard, Nashik', is_deleted: 0, created_at: new Date().toISOString() },
      { id: 5, name: 'Sneha Kulkarni', phone: '9988776655', address: 'Plot 55, Model Colony, Nagpur', is_deleted: 0, created_at: new Date().toISOString() },
      { id: 6, name: 'Vikram Singh', phone: '9711223344', address: '22 Rajouri Garden, New Delhi', is_deleted: 0, created_at: new Date().toISOString() }
    ],
    products: [
      { id: 1, name: 'Basmati Rice (1kg)', category: 'Grocery', price: 110.00, gst_percent: 5.00, stock_qty: 50, low_stock_limit: 10, is_deleted: 0, created_at: new Date().toISOString() },
      { id: 2, name: 'Refined Sunflower Oil (1L)', category: 'Grocery', price: 145.00, gst_percent: 5.00, stock_qty: 35, low_stock_limit: 8, is_deleted: 0, created_at: new Date().toISOString() },
      { id: 3, name: 'Whole Wheat Atta (5kg)', category: 'Grocery', price: 230.00, gst_percent: 0.00, stock_qty: 40, low_stock_limit: 10, is_deleted: 0, created_at: new Date().toISOString() },
      { id: 4, name: 'Tata Tea Gold (500g)', category: 'Beverages', price: 260.00, gst_percent: 5.00, stock_qty: 25, low_stock_limit: 5, is_deleted: 0, created_at: new Date().toISOString() },
      { id: 5, name: 'Cadbury Dairy Milk Silk', category: 'Confectionery', price: 85.00, gst_percent: 18.00, stock_qty: 60, low_stock_limit: 15, is_deleted: 0, created_at: new Date().toISOString() },
      { id: 6, name: 'Dettol Antiseptic Liquid (250ml)', category: 'Personal Care', price: 125.00, gst_percent: 12.00, stock_qty: 3, low_stock_limit: 5, is_deleted: 0, created_at: new Date().toISOString() },
      { id: 7, name: 'Surf Excel Detergent (1kg)', category: 'Household', price: 140.00, gst_percent: 18.00, stock_qty: 20, low_stock_limit: 5, is_deleted: 0, created_at: new Date().toISOString() },
      { id: 8, name: 'Amul Butter (500g)', category: 'Dairy', price: 275.00, gst_percent: 12.00, stock_qty: 18, low_stock_limit: 5, is_deleted: 0, created_at: new Date().toISOString() },
      { id: 9, name: 'Colgate Total Toothpaste (150g)', category: 'Personal Care', price: 95.00, gst_percent: 12.00, stock_qty: 4, low_stock_limit: 10, is_deleted: 0, created_at: new Date().toISOString() },
      { id: 10, name: 'Aashirvaad Salt (1kg)', category: 'Grocery', price: 28.00, gst_percent: 0.00, stock_qty: 80, low_stock_limit: 15, is_deleted: 0, created_at: new Date().toISOString() }
    ],
    bills: [
      {
        id: 1,
        bill_no: 'INV-0001',
        customer_id: 2,
        bill_date: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0],
        subtotal: 595.00,
        discount: 25.00,
        tax: 28.50,
        total_amount: 598.50,
        amount_paid: 300.00,
        amount_pending: 298.50,
        status: 'PARTIAL',
        payment_mode: 'CASH',
        notes: 'Regular monthly essentials',
        is_deleted: 0,
        created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 2,
        bill_no: 'INV-0002',
        customer_id: 3,
        bill_date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
        subtotal: 535.00,
        discount: 0.00,
        tax: 48.00,
        total_amount: 583.00,
        amount_paid: 583.00,
        amount_pending: 0.00,
        status: 'PAID',
        payment_mode: 'UPI',
        notes: 'Paid via PhonePe',
        is_deleted: 0,
        created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 3,
        bill_no: 'INV-0003',
        customer_id: 2,
        bill_date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
        subtotal: 310.00,
        discount: 10.00,
        tax: 42.30,
        total_amount: 342.30,
        amount_paid: 0.00,
        amount_pending: 342.30,
        status: 'UNPAID',
        payment_mode: 'CREDIT',
        notes: 'Added to account',
        is_deleted: 0,
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        updated_at: new Date().toISOString()
      }
    ],
    bill_items: [
      { id: 1, bill_id: 1, product_id: 1, product_name: 'Basmati Rice (1kg)', qty: 2, rate: 110.00, gst_percent: 5.00, amount: 220.00 },
      { id: 2, bill_id: 1, product_id: 2, product_name: 'Refined Sunflower Oil (1L)', qty: 1, rate: 145.00, gst_percent: 5.00, amount: 145.00 },
      { id: 3, bill_id: 1, product_id: 3, product_name: 'Whole Wheat Atta (5kg)', qty: 1, rate: 230.00, gst_percent: 0.00, amount: 230.00 },
      { id: 4, bill_id: 2, product_id: 4, product_name: 'Tata Tea Gold (500g)', qty: 1, rate: 260.00, gst_percent: 5.00, amount: 260.00 },
      { id: 5, bill_id: 2, product_id: 8, product_name: 'Amul Butter (500g)', qty: 1, rate: 275.00, gst_percent: 12.00, amount: 275.00 },
      { id: 6, bill_id: 3, product_id: 5, product_name: 'Cadbury Dairy Milk Silk', qty: 2, rate: 85.00, gst_percent: 18.00, amount: 170.00 },
      { id: 7, bill_id: 3, product_id: 7, product_name: 'Surf Excel Detergent (1kg)', qty: 1, rate: 140.00, gst_percent: 18.00, amount: 140.00 }
    ],
    payments: [
      { id: 1, customer_id: 2, bill_id: 1, amount: 300.00, payment_date: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0], mode: 'CASH', note: 'Initial deposit on bill INV-0001', is_deleted: 0, created_at: new Date().toISOString() },
      { id: 2, customer_id: 3, bill_id: 2, amount: 583.00, payment_date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0], mode: 'UPI', note: 'Paid full amount for INV-0002', is_deleted: 0, created_at: new Date().toISOString() }
    ],
    settings: [
      {
        id: 1,
        shop_name: 'Vikas Super Market',
        address: '124 Main Street, Commercial Hub, Mumbai - 400001',
        phone: '022-28471920',
        gst_number: 'GSTIN27AABCU9603R1ZM',
        invoice_footer: 'Thank you for shopping with us! Goods once sold can be exchanged within 7 days.'
      }
    ]
  };

  // Try to load any saved state from disk if exists
  const statePath = process.env.VERCEL
    ? path.join('/tmp', '.demo_db.json')
    : path.join(__dirname, '../../.demo_db.json');
  if (fs.existsSync(statePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      fallbackStore = data;
    } catch (e) {
      // ignore
    }
  }

  return fallbackStore;
}

function saveFallbackStore() {
  if (!fallbackStore) return;
  const statePath = process.env.VERCEL
    ? path.join('/tmp', '.demo_db.json')
    : path.join(__dirname, '../../.demo_db.json');
  try {
    fs.writeFileSync(statePath, JSON.stringify(fallbackStore, null, 2), 'utf8');
  } catch (e) {
    // ignore
  }
}

// Fallback executor for common SQL operations
function executeFallbackQuery(sql, params = []) {
  initializeFallbackStore();
  const trimmed = sql.trim();
  const lower = trimmed.toLowerCase();

  // Helper to deep clone
  const clone = val => JSON.parse(JSON.stringify(val));

  // 1. SELECT queries
  if (lower.startsWith('select')) {
    // Settings
    if (lower.includes('from settings')) {
      const row = fallbackStore.settings[0] || {};
      return [[clone(row)], []];
    }

    // Users by email or id
    if (lower.includes('from users')) {
      if (lower.includes('email = ?')) {
        const email = params[0];
        const user = fallbackStore.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase());
        return [[user ? clone(user) : undefined].filter(Boolean), []];
      }
      if (lower.includes('id = ?')) {
        const id = Number(params[0]);
        const user = fallbackStore.users.find(u => u.id === id);
        return [[user ? clone(user) : undefined].filter(Boolean), []];
      }
      return [clone(fallbackStore.users), []];
    }

    // Customer by ID or List
    if (lower.includes('from customers') && (lower.includes('where id = ?') || lower.includes('where c.id = ?'))) {
      const id = Number(params[params.length - 1] || params[0]);
      const cust = fallbackStore.customers.find(c => c.id === id && !c.is_deleted);
      if (!cust) return [[], []];

      const custBills = fallbackStore.bills.filter(b => b.customer_id === id && !b.is_deleted);
      const custPayments = fallbackStore.payments.filter(p => p.customer_id === id && !p.is_deleted);

      const totalBilled = custBills.reduce((acc, b) => acc + (Number(b.total_amount) || 0), 0);
      const totalPaid = custPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      const pendingBalance = Math.max(0, Math.round((totalBilled - totalPaid) * 100) / 100);

      return [[{
        ...clone(cust),
        total_billed: Math.round(totalBilled * 100) / 100,
        total_paid: Math.round(totalPaid * 100) / 100,
        pending_balance: pendingBalance
      }], []];
    }

    if (lower.includes('from customers') && !lower.includes('from bills')) {
      let list = fallbackStore.customers.filter(c => !c.is_deleted);
      const enriched = list.map(c => {
        const custBills = fallbackStore.bills.filter(b => b.customer_id === c.id && !b.is_deleted);
        const custPayments = fallbackStore.payments.filter(p => p.customer_id === c.id && !p.is_deleted);

        const totalBilled = custBills.reduce((acc, b) => acc + (Number(b.total_amount) || 0), 0);
        const totalPaid = custPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
        const pendingBalance = Math.max(0, Math.round((totalBilled - totalPaid) * 100) / 100);

        let lastPurchaseDate = null;
        if (custBills.length > 0) {
          const sorted = [...custBills].sort((a, b) => b.bill_date.localeCompare(a.bill_date));
          lastPurchaseDate = sorted[0].bill_date;
        }

        return {
          ...c,
          total_billed: Math.round(totalBilled * 100) / 100,
          total_paid: Math.round(totalPaid * 100) / 100,
          pending_balance: pendingBalance,
          last_purchase_date: lastPurchaseDate
        };
      });

      return [enriched, []];
    }

    // Bill Number generation (SELECT bill_no FROM bills ORDER BY id DESC LIMIT 1)
    if (lower.includes('from bills') && lower.includes('order by id desc limit 1')) {
      const sorted = [...fallbackStore.bills].sort((a, b) => b.id - a.id);
      return [[sorted[0] ? { bill_no: sorted[0].bill_no } : undefined].filter(Boolean), []];
    }

    // Customer ledger monthly view
    // SELECT DATE_FORMAT(bill_date, '%Y-%m') AS month, SUM(total_amount) AS billed, ...
    if (lower.includes('as month') && lower.includes('from bills') && lower.includes('group by month')) {
      const customerId = Number(params[0]);
      const from = params[1] || '1970-01-01';
      const to = params[2] || '2099-12-31';

      const filtered = fallbackStore.bills.filter(b => 
        b.customer_id === customerId && 
        !b.is_deleted && 
        b.bill_date >= from && 
        b.bill_date <= to
      );

      const monthsMap = {};
      filtered.forEach(b => {
        const m = b.bill_date.substring(0, 7);
        if (!monthsMap[m]) {
          monthsMap[m] = { month: m, billed: 0, paid: 0, pending: 0, bill_count: 0 };
        }
        monthsMap[m].billed += Number(b.total_amount) || 0;
        monthsMap[m].paid += Number(b.amount_paid) || 0;
        monthsMap[m].pending += Number(b.amount_pending) || 0;
        monthsMap[m].bill_count += 1;
      });

      const list = Object.values(monthsMap).sort((a, b) => b.month.localeCompare(a.month));
      return [list, []];
    }

    // Customer summary
    // SELECT SUM(total_amount) as total_billed, SUM(amount_paid) as total_paid, SUM(amount_pending) as total_pending FROM bills WHERE customer_id = ?
    if (lower.includes('sum(total_amount)') && lower.includes('from bills') && lower.includes('customer_id = ?')) {
      const customerId = Number(params[0]);
      const from = params[1];
      const to = params[2];

      const filteredBills = fallbackStore.bills.filter(b => {
        if (b.customer_id !== customerId || b.is_deleted) return false;
        if (from && b.bill_date < from) return false;
        if (to && b.bill_date > to) return false;
        return true;
      });

      const totalBilled = filteredBills.reduce((acc, b) => acc + (Number(b.total_amount) || 0), 0);
      const totalPaidBills = filteredBills.reduce((acc, b) => acc + (Number(b.amount_paid) || 0), 0);
      const totalPending = filteredBills.reduce((acc, b) => acc + (Number(b.amount_pending) || 0), 0);

      // Customer payments
      const filteredPayments = fallbackStore.payments.filter(p => {
        if (p.customer_id !== customerId || p.is_deleted) return false;
        if (from && p.payment_date < from) return false;
        if (to && p.payment_date > to) return false;
        return true;
      });
      const totalPayments = filteredPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

      return [[{
        total_billed: Math.round(totalBilled * 100) / 100,
        total_paid: Math.round(totalPayments * 100) / 100,
        total_pending: Math.max(0, Math.round((totalBilled - totalPayments) * 100) / 100),
        bill_count: filteredBills.length
      }], []];
    }

    // Dashboard summary
    if (lower.includes('from bills') && (lower.includes('today_sales') || lower.includes('month_sales'))) {
      const today = new Date().toISOString().split('T')[0];
      const currentMonth = today.substring(0, 7);

      const todaySales = fallbackStore.bills
        .filter(b => !b.is_deleted && b.bill_date === today)
        .reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);

      const monthSales = fallbackStore.bills
        .filter(b => !b.is_deleted && b.bill_date.startsWith(currentMonth))
        .reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);

      const totalPendingDues = fallbackStore.bills
        .filter(b => !b.is_deleted && b.customer_id !== 1)
        .reduce((sum, b) => sum + (Number(b.amount_pending) || 0), 0);

      return [[{
        today_sales: Math.round(todaySales * 100) / 100,
        month_sales: Math.round(monthSales * 100) / 100,
        total_pending_dues: Math.round(totalPendingDues * 100) / 100
      }], []];
    }

    // Top products
    if (lower.includes('from bill_items') && lower.includes('group by product_id')) {
      const map = {};
      fallbackStore.bill_items.forEach(bi => {
        const bill = fallbackStore.bills.find(b => b.id === bi.bill_id);
        if (bill && !bill.is_deleted) {
          if (!map[bi.product_id]) {
            map[bi.product_id] = { product_id: bi.product_id, product_name: bi.product_name, total_qty: 0, total_sales: 0 };
          }
          map[bi.product_id].total_qty += Number(bi.qty) || 0;
          map[bi.product_id].total_sales += Number(bi.amount) || 0;
        }
      });
      const top = Object.values(map).sort((a, b) => b.total_sales - a.total_sales).slice(0, 5);
      return [top, []];
    }

    // Top customers
    if (lower.includes('from bills') && lower.includes('group by customer_id') && lower.includes('order by')) {
      const map = {};
      fallbackStore.bills.forEach(b => {
        if (!b.is_deleted && b.customer_id !== 1) {
          if (!map[b.customer_id]) {
            const cust = fallbackStore.customers.find(c => c.id === b.customer_id);
            map[b.customer_id] = {
              customer_id: b.customer_id,
              name: cust ? cust.name : 'Unknown',
              phone: cust ? cust.phone : '',
              total_spend: 0,
              bill_count: 0
            };
          }
          map[b.customer_id].total_spend += Number(b.total_amount) || 0;
          map[b.customer_id].bill_count += 1;
        }
      });
      const top = Object.values(map).sort((a, b) => b.total_spend - a.total_spend).slice(0, 5);
      return [top, []];
    }

    // Sales chart data
    if (lower.includes('from bills') && lower.includes('group by') && (lower.includes('bill_date') || lower.includes('date_format'))) {
      const from = params[0] || '1970-01-01';
      const to = params[1] || '2099-12-31';
      const isMonth = lower.includes('%y-%m');

      const filtered = fallbackStore.bills.filter(b => !b.is_deleted && b.bill_date >= from && b.bill_date <= to);
      const groups = {};

      filtered.forEach(b => {
        const key = isMonth ? b.bill_date.substring(0, 7) : b.bill_date;
        if (!groups[key]) groups[key] = { label: key, total: 0, count: 0 };
        groups[key].total += Number(b.total_amount) || 0;
        groups[key].count += 1;
      });

      const result = Object.values(groups).sort((a, b) => a.label.localeCompare(b.label));
      return [result, []];
    }

    // Low stock products
    if (lower.includes('from products') && lower.includes('stock_qty <= low_stock_limit')) {
      const low = fallbackStore.products.filter(p => !p.is_deleted && Number(p.stock_qty) <= Number(p.low_stock_limit));
      return [clone(low), []];
    }

    // Customer by ID
    if (lower.includes('from customers') && (lower.includes('where id = ?') || lower.includes('where c.id = ?'))) {
      const id = Number(params[0]);
      const cust = fallbackStore.customers.find(c => c.id === id && !c.is_deleted);
      if (!cust) return [[], []];

      const custBills = fallbackStore.bills.filter(b => b.customer_id === id && !b.is_deleted);
      const custPayments = fallbackStore.payments.filter(p => p.customer_id === id && !p.is_deleted);

      const totalBilled = custBills.reduce((acc, b) => acc + (Number(b.total_amount) || 0), 0);
      const totalPaid = custPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      const pendingBalance = Math.max(0, Math.round((totalBilled - totalPaid) * 100) / 100);

      return [[{
        ...clone(cust),
        total_billed: Math.round(totalBilled * 100) / 100,
        total_paid: Math.round(totalPaid * 100) / 100,
        pending_balance: pendingBalance
      }], []];
    }

    // Customers list with totals
    if (lower.includes('from customers')) {
      let list = fallbackStore.customers.filter(c => !c.is_deleted);
      
      // Calculate totals for each customer
      const enriched = list.map(c => {
        const custBills = fallbackStore.bills.filter(b => b.customer_id === c.id && !b.is_deleted);
        const custPayments = fallbackStore.payments.filter(p => p.customer_id === c.id && !p.is_deleted);
        
        const totalBilled = custBills.reduce((acc, b) => acc + (Number(b.total_amount) || 0), 0);
        const totalPaid = custPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
        const pendingBalance = Math.max(0, Math.round((totalBilled - totalPaid) * 100) / 100);

        let lastPurchaseDate = null;
        if (custBills.length > 0) {
          const sorted = [...custBills].sort((a, b) => b.bill_date.localeCompare(a.bill_date));
          lastPurchaseDate = sorted[0].bill_date;
        }

        return {
          ...c,
          total_billed: Math.round(totalBilled * 100) / 100,
          total_paid: Math.round(totalPaid * 100) / 100,
          pending_balance: pendingBalance,
          last_purchase_date: lastPurchaseDate
        };
      });

      return [enriched, []];
    }

    // Product by ID
    if (lower.includes('from products') && lower.includes('where id = ?')) {
      const id = Number(params[0]);
      const prod = fallbackStore.products.find(p => p.id === id);
      return [[prod ? clone(prod) : undefined].filter(Boolean), []];
    }

    // Products list
    if (lower.includes('from products')) {
      const list = fallbackStore.products.filter(p => !p.is_deleted);
      return [clone(list), []];
    }

    // Bill by ID (single)
    if (lower.includes('from bills') && (lower.includes('where id = ?') || lower.includes('where b.id = ?'))) {
      const id = Number(params[0]);
      const bill = fallbackStore.bills.find(b => b.id === id && !b.is_deleted);
      if (!bill) return [[], []];

      if (lower.includes('customer_id = ?')) {
        const custId = Number(params[1]);
        if (bill.customer_id !== custId) return [[], []];
      }

      const cust = fallbackStore.customers.find(c => c.id === bill.customer_id);
      return [[{
        ...clone(bill),
        customer_name: cust ? cust.name : '',
        customer_phone: cust ? cust.phone : '',
        customer_address: cust ? cust.address : ''
      }], []];
    }

    // Bill items for a bill
    if (lower.includes('from bill_items') && lower.includes('where bill_id = ?')) {
      const billId = Number(params[0]);
      const items = fallbackStore.bill_items.filter(bi => bi.bill_id === billId);
      return [clone(items), []];
    }

    // Payments sum aggregation
    if (lower.includes('from payments') && lower.includes('sum(amount)')) {
      const custId = Number(params[0]);
      const from = params[1];
      const to = params[2];
      const filtered = fallbackStore.payments.filter(p => {
        if (p.is_deleted || p.customer_id !== custId) return false;
        if (from && p.payment_date < from) return false;
        if (to && p.payment_date > to) return false;
        return true;
      });
      const sum = filtered.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
      return [[{ total_paid: Math.round(sum * 100) / 100 }], []];
    }

    // Payments for a customer or bill
    if (lower.includes('from payments')) {
      let filtered = fallbackStore.payments.filter(p => !p.is_deleted);
      if (lower.includes('customer_id = ?')) {
        const custId = Number(params[0]);
        filtered = filtered.filter(p => p.customer_id === custId);
      }
      if (lower.includes('bill_id = ?')) {
        const billId = Number(params[0]);
        filtered = filtered.filter(p => p.bill_id === billId);
      }
      // Sort desc by date
      filtered.sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || '') || b.id - a.id);
      return [clone(filtered), []];
    }

    // Bills list
    if (lower.includes('from bills')) {
      let list = fallbackStore.bills.filter(b => !b.is_deleted);
      if (lower.includes('customer_id = ?') || lower.includes('b.customer_id = ?')) {
        const custId = Number(params[0]);
        list = list.filter(b => b.customer_id === custId);
      }
      if (lower.includes('bill_date between ? and ?') && params.length >= 3) {
        const from = params[1] || '1970-01-01';
        const to = params[2] || '2099-12-31';
        list = list.filter(b => b.bill_date >= from && b.bill_date <= to);
      }
      const enriched = list.map(b => {
        const cust = fallbackStore.customers.find(c => c.id === b.customer_id);
        const items = fallbackStore.bill_items.filter(bi => bi.bill_id === b.id);
        return {
          ...b,
          customer_name: cust ? cust.name : 'Unknown',
          customer_phone: cust ? cust.phone : '',
          items_count: items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0)
        };
      });
      enriched.sort((a, b) => (b.bill_date || '').localeCompare(a.bill_date || '') || b.id - a.id);
      return [enriched, []];
    }
  }

  // 2. INSERT queries
  if (lower.startsWith('insert into')) {
    if (lower.includes('insert into customers')) {
      const id = fallbackStore.customers.reduce((max, c) => Math.max(max, c.id), 0) + 1;
      const newCust = {
        id,
        name: params[0],
        phone: params[1],
        address: params[2],
        is_deleted: 0,
        created_at: new Date().toISOString()
      };
      fallbackStore.customers.push(newCust);
      saveFallbackStore();
      return [{ insertId: id, affectedRows: 1 }, []];
    }

    if (lower.includes('insert into products')) {
      const id = fallbackStore.products.reduce((max, p) => Math.max(max, p.id), 0) + 1;
      const newProd = {
        id,
        name: params[0],
        category: params[1],
        price: Number(params[2]),
        gst_percent: Number(params[3]),
        stock_qty: Number(params[4]),
        low_stock_limit: Number(params[5]),
        is_deleted: 0,
        created_at: new Date().toISOString()
      };
      fallbackStore.products.push(newProd);
      saveFallbackStore();
      return [{ insertId: id, affectedRows: 1 }, []];
    }

    if (lower.includes('insert into bills')) {
      const id = fallbackStore.bills.reduce((max, b) => Math.max(max, b.id), 0) + 1;
      const newBill = {
        id,
        bill_no: params[0],
        customer_id: Number(params[1]),
        bill_date: params[2],
        subtotal: Number(params[3]),
        discount: Number(params[4]),
        tax: Number(params[5]),
        total_amount: Number(params[6]),
        amount_paid: Number(params[7]),
        amount_pending: Number(params[8]),
        status: params[9],
        payment_mode: params[10],
        notes: params[11],
        is_deleted: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      fallbackStore.bills.push(newBill);
      saveFallbackStore();
      return [{ insertId: id, affectedRows: 1 }, []];
    }

    if (lower.includes('insert into bill_items')) {
      const id = fallbackStore.bill_items.reduce((max, bi) => Math.max(max, bi.id), 0) + 1;
      const newItem = {
        id,
        bill_id: Number(params[0]),
        product_id: Number(params[1]),
        product_name: params[2],
        qty: Number(params[3]),
        rate: Number(params[4]),
        gst_percent: Number(params[5]),
        amount: Number(params[6])
      };
      fallbackStore.bill_items.push(newItem);
      saveFallbackStore();
      return [{ insertId: id, affectedRows: 1 }, []];
    }

    if (lower.includes('insert into payments')) {
      const id = fallbackStore.payments.reduce((max, p) => Math.max(max, p.id), 0) + 1;
      const newPayment = {
        id,
        customer_id: Number(params[0]),
        bill_id: params[1] ? Number(params[1]) : null,
        amount: Number(params[2]),
        payment_date: params[3],
        mode: params[4],
        note: params[5],
        is_deleted: 0,
        created_at: new Date().toISOString()
      };
      fallbackStore.payments.push(newPayment);
      saveFallbackStore();
      return [{ insertId: id, affectedRows: 1 }, []];
    }
  }

  // 3. UPDATE queries
  if (lower.startsWith('update')) {
    if (lower.includes('update products set stock_qty = stock_qty - ?')) {
      const qty = Number(params[0]);
      const prodId = Number(params[1]);
      const prod = fallbackStore.products.find(p => p.id === prodId);
      if (prod) prod.stock_qty = Math.max(0, prod.stock_qty - qty);
      saveFallbackStore();
      return [{ affectedRows: 1 }, []];
    }

    if (lower.includes('update products set stock_qty = stock_qty + ?')) {
      const qty = Number(params[0]);
      const prodId = Number(params[1]);
      const prod = fallbackStore.products.find(p => p.id === prodId);
      if (prod) prod.stock_qty += qty;
      saveFallbackStore();
      return [{ affectedRows: 1 }, []];
    }

    if (lower.includes('update products')) {
      const prodId = Number(params[params.length - 1]);
      const prod = fallbackStore.products.find(p => p.id === prodId);
      if (prod) {
        if (lower.includes('is_deleted = 1')) {
          prod.is_deleted = 1;
        } else {
          prod.name = params[0];
          prod.category = params[1];
          prod.price = Number(params[2]);
          prod.gst_percent = Number(params[3]);
          prod.stock_qty = Number(params[4]);
          prod.low_stock_limit = Number(params[5]);
        }
      }
      saveFallbackStore();
      return [{ affectedRows: 1 }, []];
    }

    if (lower.includes('update customers')) {
      const custId = Number(params[params.length - 1]);
      const cust = fallbackStore.customers.find(c => c.id === custId);
      if (cust) {
        if (lower.includes('is_deleted = 1')) {
          cust.is_deleted = 1;
        } else {
          cust.name = params[0];
          cust.phone = params[1];
          cust.address = params[2];
        }
      }
      saveFallbackStore();
      return [{ affectedRows: 1 }, []];
    }

    if (lower.includes('update bills')) {
      const billId = Number(params[params.length - 1]);
      const bill = fallbackStore.bills.find(b => b.id === billId);
      if (bill) {
        if (lower.includes('is_deleted = 1')) {
          bill.is_deleted = 1;
        } else if (lower.includes('amount_paid = ?, amount_pending = ?, status = ?')) {
          bill.amount_paid = Number(params[0]);
          bill.amount_pending = Number(params[1]);
          bill.status = params[2];
          bill.updated_at = new Date().toISOString();
        } else {
          bill.subtotal = Number(params[0]);
          bill.discount = Number(params[1]);
          bill.tax = Number(params[2]);
          bill.total_amount = Number(params[3]);
          bill.amount_paid = Number(params[4]);
          bill.amount_pending = Number(params[5]);
          bill.status = params[6];
          bill.payment_mode = params[7];
          bill.notes = params[8];
          bill.updated_at = new Date().toISOString();
        }
      }
      saveFallbackStore();
      return [{ affectedRows: 1 }, []];
    }

    if (lower.includes('update payments')) {
      const paymentId = Number(params[params.length - 1]);
      const pay = fallbackStore.payments.find(p => p.id === paymentId);
      if (pay) {
        if (lower.includes('is_deleted = 1')) {
          pay.is_deleted = 1;
        } else {
          pay.amount = Number(params[0]);
          pay.payment_date = params[1];
          pay.mode = params[2];
          pay.note = params[3];
        }
      }
      saveFallbackStore();
      return [{ affectedRows: 1 }, []];
    }

    if (lower.includes('update settings')) {
      if (fallbackStore.settings[0]) {
        fallbackStore.settings[0] = {
          id: 1,
          shop_name: params[0],
          address: params[1],
          phone: params[2],
          gst_number: params[3],
          invoice_footer: params[4]
        };
      }
      saveFallbackStore();
      return [{ affectedRows: 1 }, []];
    }
  }

  // 4. DELETE queries
  if (lower.startsWith('delete from bill_items where bill_id = ?')) {
    const billId = Number(params[0]);
    fallbackStore.bill_items = fallbackStore.bill_items.filter(bi => bi.bill_id !== billId);
    saveFallbackStore();
    return [{ affectedRows: 1 }, []];
  }

  return [[], []];
}

// Wrapper for database connection in transactions
function createMockConnection() {
  return {
    async query(sql, params) {
      return executeFallbackQuery(sql, params);
    },
    async execute(sql, params) {
      return executeFallbackQuery(sql, params);
    },
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {}
  };
}

// Run schema and seed automatically on a fresh cloud MySQL instance if empty
async function autoMigrateIfEmpty(conn) {
  try {
    const [tables] = await conn.query("SHOW TABLES LIKE 'users'");
    if (!tables || tables.length === 0) {
      console.log('[DB] Fresh MySQL database detected. Applying schema migrations...');
      const schemaPath = path.join(__dirname, '../../../database/schema.sql');
      const seedPath = path.join(__dirname, '../../../database/seed.sql');

      if (fs.existsSync(schemaPath)) {
        let schemaSql = fs.readFileSync(schemaPath, 'utf8');
        // Strip hardcoded CREATE DATABASE/USE statements so tables are created in the active DB
        schemaSql = schemaSql.replace(/CREATE DATABASE[^;]+;/gi, '').replace(/USE[^;]+;/gi, '');
        await conn.query(schemaSql);
        console.log('[DB] Schema created successfully.');
      }

      if (fs.existsSync(seedPath)) {
        let seedSql = fs.readFileSync(seedPath, 'utf8');
        seedSql = seedSql.replace(/USE[^;]+;/gi, '');
        await conn.query(seedSql);
        console.log('[DB] Initial seed data inserted successfully.');
      }
    }
  } catch (migErr) {
    console.warn('[DB] Auto-migration notice:', migErr.message);
  }
}

// Initialize database pool
async function initDB() {
  try {
    const directPool = mysql.createPool(dbConfig);
    // Connection test & optional auto-migration
    const conn = await directPool.getConnection();
    try {
      await autoMigrateIfEmpty(conn);
    } finally {
      conn.release();
    }

    pool = directPool;
    isUsingFallback = false;
    const dbTarget = connectionUri ? 'URI' : `${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;
    console.log(`[DB] Connected successfully to MySQL (${dbTarget})`);
    return pool;
  } catch (err) {
    console.warn(`[DB] Warning: MySQL not accessible (${err.message}). Using Embedded Demo Store.`);
    isUsingFallback = true;
    initializeFallbackStore();

    pool = {
      async query(sql, params) {
        return executeFallbackQuery(sql, params);
      },
      async execute(sql, params) {
        return executeFallbackQuery(sql, params);
      },
      async getConnection() {
        return createMockConnection();
      }
    };
    return pool;
  }
}

// Proxy wrapper so imports can immediately destructure `pool`
const dbProxy = new Proxy({}, {
  get(target, prop) {
    if (prop === 'initDB') return initDB;
    if (prop === 'isFallback') return () => isUsingFallback;
    if (pool && typeof pool[prop] === 'function') {
      return pool[prop].bind(pool);
    }
    if (pool && prop in pool) {
      return pool[prop];
    }
    // Default delegators
    return async (...args) => {
      if (!pool) {
        await initDB();
      }
      return pool[prop](...args);
    };
  }
});

module.exports = dbProxy;
