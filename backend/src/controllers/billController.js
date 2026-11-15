const billService = require('../services/billService');
const db = require('../config/db');
const { determineBillStatus, round2 } = require('../utils/calc');

async function createBill(req, res, next) {
  try {
    const {
      customer_id,
      bill_date,
      items,
      discount,
      amount_paid,
      payment_mode,
      notes
    } = req.body;

    const bill = await billService.createBill({
      customer_id,
      bill_date,
      items,
      discount,
      amount_paid,
      payment_mode,
      notes
    });

    return res.status(201).json({
      success: true,
      message: `Bill ${bill.bill_no} created successfully`,
      data: bill
    });
  } catch (err) {
    next(err);
  }
}

async function getAllBills(req, res, next) {
  try {
    const { from, to, customerId, status } = req.query;
    const bills = await billService.getAllBills({ from, to, customerId, status });

    return res.json({
      success: true,
      data: bills
    });
  } catch (err) {
    next(err);
  }
}

async function getBillById(req, res, next) {
  try {
    const { id } = req.params;
    const bill = await billService.getBillById(id);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    return res.json({
      success: true,
      data: bill
    });
  } catch (err) {
    next(err);
  }
}

async function updateBill(req, res, next) {
  try {
    const { id } = req.params;
    const { items, discount, amount_paid, payment_mode, notes } = req.body;

    const updated = await billService.updateBill(id, {
      items,
      discount,
      amount_paid,
      payment_mode,
      notes
    });

    return res.json({
      success: true,
      message: 'Bill updated successfully',
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

// Inline quick edit of amount paid on a bill with payment ledger reconciliation
async function quickUpdatePaid(req, res, next) {
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    const { id } = req.params;
    const { amount_paid } = req.body;

    const [rows] = await connection.query(
      'SELECT id, customer_id, bill_no, bill_date, total_amount, amount_paid FROM bills WHERE id = ? AND is_deleted = 0',
      [id]
    );

    if (!rows || rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    const bill = rows[0];
    const newPaid = round2(amount_paid);
    const total = round2(bill.total_amount);

    if (isNaN(newPaid) || newPaid < 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Amount paid cannot be negative'
      });
    }

    if (newPaid > total) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `Amount paid (${newPaid}) cannot exceed total bill amount (${total})`
      });
    }

    // Get current active payments for this bill
    const [paymentRows] = await connection.query(
      'SELECT id, amount FROM payments WHERE bill_id = ? AND is_deleted = 0 ORDER BY id DESC',
      [id]
    );

    const existingPaymentsSum = round2(
      paymentRows.reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
    );
    const delta = round2(newPaid - existingPaymentsSum);

    if (delta > 0) {
      await connection.query(
        `
        INSERT INTO payments (customer_id, bill_id, amount, payment_date, mode, note)
        VALUES (?, ?, ?, ?, 'CASH', ?)
        `,
        [
          bill.customer_id,
          id,
          delta,
          bill.bill_date || new Date().toISOString().split('T')[0],
          `Payment update for bill ${bill.bill_no}`
        ]
      );
    } else if (delta < 0) {
      let reductionNeeded = Math.abs(delta);
      for (const pay of paymentRows) {
        if (reductionNeeded <= 0) break;
        const currentPayAmount = Number(pay.amount) || 0;
        if (currentPayAmount <= reductionNeeded) {
          await connection.query('UPDATE payments SET is_deleted = 1 WHERE id = ?', [pay.id]);
          reductionNeeded = round2(reductionNeeded - currentPayAmount);
        } else {
          const updatedAmount = round2(currentPayAmount - reductionNeeded);
          await connection.query('UPDATE payments SET amount = ? WHERE id = ?', [updatedAmount, pay.id]);
          reductionNeeded = 0;
        }
      }
    }

    const pending = round2(Math.max(0, total - newPaid));
    const status = determineBillStatus(total, newPaid);

    await connection.query(
      'UPDATE bills SET amount_paid = ?, amount_pending = ?, status = ? WHERE id = ?',
      [newPaid, pending, status, id]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: 'Bill payment amount updated and ledger reconciled',
      data: {
        id: Number(id),
        amount_paid: newPaid,
        amount_pending: pending,
        status
      }
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
}

async function deleteBill(req, res, next) {
  try {
    const { id } = req.params;
    await billService.deleteBill(id);

    return res.json({
      success: true,
      message: 'Bill deleted successfully'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createBill,
  getAllBills,
  getBillById,
  updateBill,
  quickUpdatePaid,
  deleteBill
};
