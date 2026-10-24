const db = require('../config/db');
const { round2 } = require('../utils/calc');

// List customers with live calculated totals
async function getAllCustomers(req, res, next) {
  try {
    const { search, hasPending } = req.query;

    let query = `
      SELECT 
        c.id, 
        c.name, 
        c.phone, 
        c.address, 
        c.created_at,
        COALESCE(b.total_billed, 0) AS total_billed,
        COALESCE(p.total_paid, 0) AS total_paid,
        GREATEST(0, ROUND(COALESCE(b.total_billed, 0) - COALESCE(p.total_paid, 0), 2)) AS pending_balance,
        b.last_purchase_date
      FROM customers c
      LEFT JOIN (
        SELECT 
          customer_id, 
          SUM(total_amount) AS total_billed, 
          MAX(bill_date) AS last_purchase_date
        FROM bills 
        WHERE is_deleted = 0 
        GROUP BY customer_id
      ) b ON b.customer_id = c.id
      LEFT JOIN (
        SELECT 
          customer_id, 
          SUM(amount) AS total_paid
        FROM payments 
        WHERE is_deleted = 0 
        GROUP BY customer_id
      ) p ON p.customer_id = c.id
      WHERE c.is_deleted = 0
    `;

    const params = [];

    if (search && search.trim()) {
      query += ` AND (c.name LIKE ? OR c.phone LIKE ?)`;
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (hasPending === 'true') {
      query += ` HAVING pending_balance > 0`;
    }

    query += ` ORDER BY (c.id = 1) DESC, pending_balance DESC, c.name ASC`;

    const [rows] = await db.query(query, params);

    let results = rows;
    if (db.isFallback && db.isFallback()) {
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        results = results.filter(c => 
          (c.name && c.name.toLowerCase().includes(q)) || 
          (c.phone && c.phone.includes(q))
        );
      }
      if (hasPending === 'true') {
        results = results.filter(c => Number(c.pending_balance) > 0);
      }
    }

    return res.json({
      success: true,
      data: results
    });
  } catch (err) {
    next(err);
  }
}

// Get customer profile by id with totals
async function getCustomerById(req, res, next) {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      `
      SELECT 
        c.id, 
        c.name, 
        c.phone, 
        c.address, 
        c.created_at,
        COALESCE(b.total_billed, 0) AS total_billed,
        COALESCE(p.total_paid, 0) AS total_paid,
        GREATEST(0, ROUND(COALESCE(b.total_billed, 0) - COALESCE(p.total_paid, 0), 2)) AS pending_balance
      FROM customers c
      LEFT JOIN (
        SELECT customer_id, SUM(total_amount) AS total_billed 
        FROM bills 
        WHERE is_deleted = 0 AND customer_id = ?
        GROUP BY customer_id
      ) b ON b.customer_id = c.id
      LEFT JOIN (
        SELECT customer_id, SUM(amount) AS total_paid 
        FROM payments 
        WHERE is_deleted = 0 AND customer_id = ?
        GROUP BY customer_id
      ) p ON p.customer_id = c.id
      WHERE c.id = ? AND c.is_deleted = 0
      LIMIT 1
      `,
      [id, id, id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    return res.json({
      success: true,
      data: rows[0]
    });
  } catch (err) {
    next(err);
  }
}

// Get customer summary for a given date range
async function getCustomerSummary(req, res, next) {
  try {
    const { id } = req.params;
    const { from, to } = req.query;

    const fromDate = from || '1970-01-01';
    const toDate = to || '2099-12-31';

    const [billRows] = await db.query(
      `
      SELECT 
        COALESCE(SUM(total_amount), 0) AS total_billed,
        COALESCE(SUM(amount_paid), 0) AS total_paid_on_bills,
        COALESCE(SUM(amount_pending), 0) AS total_pending,
        COUNT(id) AS bill_count
      FROM bills
      WHERE customer_id = ? AND is_deleted = 0 AND bill_date BETWEEN ? AND ?
      `,
      [id, fromDate, toDate]
    );

    const [payRows] = await db.query(
      `
      SELECT COALESCE(SUM(amount), 0) AS total_paid
      FROM payments
      WHERE customer_id = ? AND is_deleted = 0 AND payment_date BETWEEN ? AND ?
      `,
      [id, fromDate, toDate]
    );

    const totalBilled = round2(billRows[0]?.total_billed || 0);
    const totalPaid = round2(payRows[0]?.total_paid || 0);
    const totalPending = round2(Math.max(0, totalBilled - totalPaid));
    const billCount = parseInt(billRows[0]?.bill_count, 10) || 0;

    return res.json({
      success: true,
      data: {
        total_billed: totalBilled,
        total_paid: totalPaid,
        total_pending: totalPending,
        bill_count: billCount
      }
    });
  } catch (err) {
    next(err);
  }
}

// Get customer transactions (daily list of bills or grouped monthly view)
async function getCustomerTransactions(req, res, next) {
  try {
    const { id } = req.params;
    const { from, to, view } = req.query;

    const fromDate = from || '1970-01-01';
    const toDate = to || '2099-12-31';

    if (view === 'monthly') {
      // Grouping query for the monthly view
      const [months] = await db.query(
        `
        SELECT 
          DATE_FORMAT(bill_date, '%Y-%m') AS month,
          SUM(total_amount) AS billed,
          SUM(amount_paid) AS paid,
          SUM(amount_pending) AS pending,
          COUNT(id) AS bill_count
        FROM bills
        WHERE customer_id = ? AND is_deleted = 0 AND bill_date BETWEEN ? AND ?
        GROUP BY month
        ORDER BY month DESC
        `,
        [id, fromDate, toDate]
      );

      return res.json({
        success: true,
        data: months
      });
    }

    // Default daily transactions view
    const [bills] = await db.query(
      `
      SELECT 
        b.id,
        b.bill_no,
        b.bill_date,
        b.subtotal,
        b.discount,
        b.tax,
        b.total_amount,
        b.amount_paid,
        b.amount_pending,
        b.status,
        b.payment_mode,
        b.notes,
        COUNT(bi.id) AS items_count
      FROM bills b
      LEFT JOIN bill_items bi ON bi.bill_id = b.id
      WHERE b.customer_id = ? AND b.is_deleted = 0 AND b.bill_date BETWEEN ? AND ?
      GROUP BY b.id
      ORDER BY b.bill_date DESC, b.id DESC
      `,
      [id, fromDate, toDate]
    );

    return res.json({
      success: true,
      data: bills
    });
  } catch (err) {
    next(err);
  }
}

// Statement data for PDF generation
async function getCustomerStatement(req, res, next) {
  try {
    const { id } = req.params;
    const { from, to } = req.query;

    const fromDate = from || '1970-01-01';
    const toDate = to || '2099-12-31';

    // 1. Customer profile
    const [custRows] = await db.query(
      'SELECT id, name, phone, address FROM customers WHERE id = ? AND is_deleted = 0',
      [id]
    );
    if (!custRows || custRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    const customer = custRows[0];

    // 2. Shop settings
    const [settingsRows] = await db.query('SELECT * FROM settings WHERE id = 1');
    const settings = settingsRows[0] || {};

    // 3. Bills in period
    const [bills] = await db.query(
      `
      SELECT id, bill_no, bill_date, total_amount, amount_paid, amount_pending, status, payment_mode
      FROM bills 
      WHERE customer_id = ? AND is_deleted = 0 AND bill_date BETWEEN ? AND ?
      ORDER BY bill_date ASC, id ASC
      `,
      [id, fromDate, toDate]
    );

    // 4. Payments in period
    const [payments] = await db.query(
      `
      SELECT p.id, p.payment_date, p.amount, p.mode, p.note, b.bill_no
      FROM payments p
      LEFT JOIN bills b ON b.id = p.bill_id
      WHERE p.customer_id = ? AND p.is_deleted = 0 AND p.payment_date BETWEEN ? AND ?
      ORDER BY p.payment_date ASC, p.id ASC
      `,
      [id, fromDate, toDate]
    );

    // 5. Totals
    const totalBilled = bills.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const pendingBalance = round2(Math.max(0, totalBilled - totalPaid));

    return res.json({
      success: true,
      data: {
        customer,
        settings,
        period: { from: fromDate, to: toDate },
        summary: {
          total_billed: round2(totalBilled),
          total_paid: round2(totalPaid),
          pending_balance: pendingBalance
        },
        bills,
        payments
      }
    });
  } catch (err) {
    next(err);
  }
}

// Create new customer
async function createCustomer(req, res, next) {
  try {
    const { name, phone, address } = req.body;

    const [result] = await db.query(
      'INSERT INTO customers (name, phone, address) VALUES (?, ?, ?)',
      [name.trim(), (phone || '').trim(), (address || '').trim()]
    );

    return res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: {
        id: result.insertId,
        name: name.trim(),
        phone: (phone || '').trim(),
        address: (address || '').trim()
      }
    });
  } catch (err) {
    next(err);
  }
}

// Update customer
async function updateCustomer(req, res, next) {
  try {
    const { id } = req.params;
    const { name, phone, address } = req.body;

    const [existing] = await db.query(
      'SELECT id FROM customers WHERE id = ? AND is_deleted = 0',
      [id]
    );

    if (!existing || existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    await db.query(
      'UPDATE customers SET name = ?, phone = ?, address = ? WHERE id = ?',
      [name.trim(), (phone || '').trim(), (address || '').trim(), id]
    );

    return res.json({
      success: true,
      message: 'Customer updated successfully',
      data: {
        id: Number(id),
        name: name.trim(),
        phone: (phone || '').trim(),
        address: (address || '').trim()
      }
    });
  } catch (err) {
    next(err);
  }
}

// Delete customer (soft delete)
async function deleteCustomer(req, res, next) {
  try {
    const { id } = req.params;

    if (Number(id) === 1) {
      return res.status(400).json({
        success: false,
        message: 'The default Walk-in customer cannot be deleted.'
      });
    }

    const [existing] = await db.query(
      'SELECT id FROM customers WHERE id = ? AND is_deleted = 0',
      [id]
    );

    if (!existing || existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found or already deleted'
      });
    }

    await db.query('UPDATE customers SET is_deleted = 1 WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllCustomers,
  getCustomerById,
  getCustomerSummary,
  getCustomerTransactions,
  getCustomerStatement,
  createCustomer,
  updateCustomer,
  deleteCustomer
};
