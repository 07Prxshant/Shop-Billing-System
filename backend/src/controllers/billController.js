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

// Inline quick edit of amount paid on a bill
async function quickUpdatePaid(req, res, next) {
  try {
    const { id } = req.params;
    const { amount_paid } = req.body;

    const [rows] = await db.query(
      'SELECT id, total_amount, amount_paid FROM bills WHERE id = ? AND is_deleted = 0',
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    const bill = rows[0];
    const newPaid = round2(amount_paid);
    const total = round2(bill.total_amount);

    if (newPaid < 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount paid cannot be negative'
      });
    }

    if (newPaid > total) {
      return res.status(400).json({
        success: false,
        message: `Amount paid (${newPaid}) cannot exceed total bill amount (${total})`
      });
    }

    const pending = round2(Math.max(0, total - newPaid));
    const status = determineBillStatus(total, newPaid);

    await db.query(
      'UPDATE bills SET amount_paid = ?, amount_pending = ?, status = ? WHERE id = ?',
      [newPaid, pending, status, id]
    );

    return res.json({
      success: true,
      message: 'Bill payment amount updated',
      data: {
        id: Number(id),
        amount_paid: newPaid,
        amount_pending: pending,
        status
      }
    });
  } catch (err) {
    next(err);
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
