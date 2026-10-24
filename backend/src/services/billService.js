const db = require('../config/db');
const { calculateBillTotals, round2 } = require('../utils/calc');
const { generateNextBillNo } = require('../utils/billNumber');

/**
 * Creates a new bill with items and updates inventory within a single DB transaction
 */
async function createBill({
  customer_id,
  bill_date,
  items,
  discount = 0,
  amount_paid = 0,
  payment_mode = 'CASH',
  notes = ''
}) {
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    const custId = parseInt(customer_id, 10) || 1;
    const billDate = bill_date || new Date().toISOString().split('T')[0];

    // 1. Verify customer exists
    const [custRows] = await connection.query(
      'SELECT id, name FROM customers WHERE id = ? AND is_deleted = 0',
      [custId]
    );
    if (!custRows || custRows.length === 0) {
      throw new Error(`Customer with ID ${custId} not found or has been deleted.`);
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('A bill must contain at least one item.');
    }

    // 2. Validate products and fetch current rates & stock
    const validatedItems = [];
    for (const item of items) {
      const prodId = parseInt(item.product_id, 10);
      const qty = parseInt(item.qty, 10);

      if (!prodId || isNaN(qty) || qty <= 0) {
        throw new Error('Each item must have a valid product_id and a positive quantity.');
      }

      const [prodRows] = await connection.query(
        'SELECT id, name, price, gst_percent, stock_qty FROM products WHERE id = ? AND is_deleted = 0',
        [prodId]
      );

      if (!prodRows || prodRows.length === 0) {
        throw new Error(`Product with ID ${prodId} was not found.`);
      }

      const product = prodRows[0];

      if (product.stock_qty < qty) {
        throw new Error(
          `Insufficient stock for "${product.name}". Available: ${product.stock_qty}, Requested: ${qty}`
        );
      }

      // Store rate and gst_percent at the time of sale
      const rate = item.rate !== undefined ? Number(item.rate) : Number(product.price);
      const gstPercent = item.gst_percent !== undefined ? Number(item.gst_percent) : Number(product.gst_percent);

      validatedItems.push({
        product_id: product.id,
        product_name: product.name,
        qty,
        rate,
        gst_percent: gstPercent
      });
    }

    // 3. Compute business calculations
    const calculations = calculateBillTotals(validatedItems, discount, amount_paid);

    // 4. Generate unique bill number (e.g. INV-0001)
    const billNo = await generateNextBillNo(connection);

    // 5. Insert bill record
    const [billResult] = await connection.query(
      `
      INSERT INTO bills (
        bill_no, customer_id, bill_date, subtotal, discount, tax,
        total_amount, amount_paid, amount_pending, status, payment_mode, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        billNo,
        custId,
        billDate,
        calculations.subtotal,
        calculations.discount,
        calculations.tax,
        calculations.total_amount,
        calculations.amount_paid,
        calculations.amount_pending,
        calculations.status,
        payment_mode,
        notes || ''
      ]
    );

    const billId = billResult.insertId;

    // 6. Insert bill items and deduct stock
    for (const item of calculations.items) {
      await connection.query(
        `
        INSERT INTO bill_items (
          bill_id, product_id, product_name, qty, rate, gst_percent, amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          billId,
          item.product_id,
          item.product_name,
          item.qty,
          item.rate,
          item.gst_percent,
          item.amount
        ]
      );

      // Deduct stock
      await connection.query(
        'UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?',
        [item.qty, item.product_id]
      );
    }

    // 7. If initial amount paid > 0, record payment entry
    if (calculations.amount_paid > 0) {
      const paymentModeForRecord = payment_mode === 'CREDIT' ? 'CASH' : payment_mode;
      await connection.query(
        `
        INSERT INTO payments (customer_id, bill_id, amount, payment_date, mode, note)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          custId,
          billId,
          calculations.amount_paid,
          billDate,
          paymentModeForRecord,
          `Initial payment for bill ${billNo}`
        ]
      );
    }

    await connection.commit();

    return {
      id: billId,
      bill_no: billNo,
      customer_id: custId,
      bill_date: billDate,
      ...calculations,
      payment_mode,
      notes
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Get bill by ID with items and customer information
 */
async function getBillById(id) {
  const [rows] = await db.query(
    `
    SELECT 
      b.*,
      c.name AS customer_name,
      c.phone AS customer_phone,
      c.address AS customer_address
    FROM bills b
    JOIN customers c ON c.id = b.customer_id
    WHERE b.id = ? AND b.is_deleted = 0
    LIMIT 1
    `,
    [id]
  );

  if (!rows || rows.length === 0) {
    return null;
  }

  const bill = rows[0];

  const [items] = await db.query(
    'SELECT * FROM bill_items WHERE bill_id = ?',
    [id]
  );

  bill.items = items;
  return bill;
}

/**
 * List bills with filters
 */
async function getAllBills({ from, to, customerId, status }) {
  let query = `
    SELECT 
      b.*,
      c.name AS customer_name,
      c.phone AS customer_phone,
      COUNT(bi.id) AS items_count
    FROM bills b
    JOIN customers c ON c.id = b.customer_id
    LEFT JOIN bill_items bi ON bi.bill_id = b.id
    WHERE b.is_deleted = 0
  `;
  const params = [];

  if (from) {
    query += ' AND b.bill_date >= ?';
    params.push(from);
  }
  if (to) {
    query += ' AND b.bill_date <= ?';
    params.push(to);
  }
  if (customerId) {
    query += ' AND b.customer_id = ?';
    params.push(customerId);
  }
  if (status) {
    query += ' AND b.status = ?';
    params.push(status);
  }

  query += ' GROUP BY b.id ORDER BY b.bill_date DESC, b.id DESC';

  const [rows] = await db.query(query, params);
  return rows;
}

/**
 * Edit a bill (adjusts stock for changed quantities, recalculates totals, in a transaction)
 */
async function updateBill(id, { items, discount = 0, amount_paid = 0, payment_mode = 'CASH', notes = '' }) {
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // 1. Fetch current bill and existing items
    const [existingBills] = await connection.query(
      'SELECT * FROM bills WHERE id = ? AND is_deleted = 0',
      [id]
    );

    if (!existingBills || existingBills.length === 0) {
      throw new Error(`Bill #${id} not found or has been deleted.`);
    }

    const bill = existingBills[0];

    const [oldItems] = await connection.query(
      'SELECT * FROM bill_items WHERE bill_id = ?',
      [id]
    );

    // 2. Restore stock for previously billed items
    for (const oldItem of oldItems) {
      await connection.query(
        'UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?',
        [oldItem.qty, oldItem.product_id]
      );
    }

    // 3. Remove old items
    await connection.query('DELETE FROM bill_items WHERE bill_id = ?', [id]);

    // 4. Validate new items and check stock
    const validatedItems = [];
    for (const item of items) {
      const prodId = parseInt(item.product_id, 10);
      const qty = parseInt(item.qty, 10);

      const [prodRows] = await connection.query(
        'SELECT id, name, price, gst_percent, stock_qty FROM products WHERE id = ? AND is_deleted = 0',
        [prodId]
      );

      if (!prodRows || prodRows.length === 0) {
        throw new Error(`Product #${prodId} not found.`);
      }

      const product = prodRows[0];
      if (product.stock_qty < qty) {
        throw new Error(`Insufficient stock for "${product.name}". Available: ${product.stock_qty}, Requested: ${qty}`);
      }

      const rate = item.rate !== undefined ? Number(item.rate) : Number(product.price);
      const gstPercent = item.gst_percent !== undefined ? Number(item.gst_percent) : Number(product.gst_percent);

      validatedItems.push({
        product_id: product.id,
        product_name: product.name,
        qty,
        rate,
        gst_percent: gstPercent
      });
    }

    // 5. Recalculate totals
    const calculations = calculateBillTotals(validatedItems, discount, amount_paid);

    // 6. Update bill
    await connection.query(
      `
      UPDATE bills SET 
        subtotal = ?, discount = ?, tax = ?, total_amount = ?,
        amount_paid = ?, amount_pending = ?, status = ?,
        payment_mode = ?, notes = ?
      WHERE id = ?
      `,
      [
        calculations.subtotal,
        calculations.discount,
        calculations.tax,
        calculations.total_amount,
        calculations.amount_paid,
        calculations.amount_pending,
        calculations.status,
        payment_mode,
        notes || '',
        id
      ]
    );

    // 7. Insert new items and deduct stock
    for (const item of calculations.items) {
      await connection.query(
        `
        INSERT INTO bill_items (bill_id, product_id, product_name, qty, rate, gst_percent, amount)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          item.product_id,
          item.product_name,
          item.qty,
          item.rate,
          item.gst_percent,
          item.amount
        ]
      );

      await connection.query(
        'UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?',
        [item.qty, item.product_id]
      );
    }

    await connection.commit();

    return {
      id: Number(id),
      bill_no: bill.bill_no,
      customer_id: bill.customer_id,
      bill_date: bill.bill_date,
      ...calculations,
      payment_mode,
      notes
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Soft delete a bill and restore stock
 */
async function deleteBill(id) {
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    const [existing] = await connection.query(
      'SELECT id, is_deleted FROM bills WHERE id = ?',
      [id]
    );

    if (!existing || existing.length === 0 || existing[0].is_deleted) {
      throw new Error(`Bill #${id} not found or already deleted.`);
    }

    // Restore stock
    const [items] = await connection.query(
      'SELECT product_id, qty FROM bill_items WHERE bill_id = ?',
      [id]
    );

    for (const it of items) {
      await connection.query(
        'UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?',
        [it.qty, it.product_id]
      );
    }

    // Soft delete bill
    await connection.query('UPDATE bills SET is_deleted = 1 WHERE id = ?', [id]);

    await connection.commit();
    return { success: true };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  createBill,
  getBillById,
  getAllBills,
  updateBill,
  deleteBill
};
