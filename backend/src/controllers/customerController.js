const db = require('../config/db');

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
    // Additional filtering for fallback mode if needed
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

    // Protect default Walk-in customer (id: 1)
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
  createCustomer,
  updateCustomer,
  deleteCustomer
};
