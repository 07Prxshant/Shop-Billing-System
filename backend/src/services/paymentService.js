const db = require('../config/db');
const { determineBillStatus, round2 } = require('../utils/calc');

/**
 * Creates a payment and updates bill status / customer balances inside a transaction
 */
async function createPayment({
  customer_id,
  bill_id = null,
  amount,
  payment_date,
  mode = 'CASH',
  note = ''
}) {
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    const custId = parseInt(customer_id, 10);
    const payAmount = round2(amount);
    const payDate = payment_date || new Date().toISOString().split('T')[0];

    if (isNaN(payAmount) || payAmount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    // 1. Verify customer exists
    const [custRows] = await connection.query(
      'SELECT id, name FROM customers WHERE id = ? AND is_deleted = 0',
      [custId]
    );
    if (!custRows || custRows.length === 0) {
      throw new Error(`Customer #${custId} not found.`);
    }

    // 2. Compute current pending balance for customer
    const [billSumRows] = await connection.query(
      'SELECT COALESCE(SUM(total_amount), 0) AS total_billed FROM bills WHERE customer_id = ? AND is_deleted = 0',
      [custId]
    );
    const [paySumRows] = await connection.query(
      'SELECT COALESCE(SUM(amount), 0) AS total_paid FROM payments WHERE customer_id = ? AND is_deleted = 0',
      [custId]
    );

    const totalBilled = Number(billSumRows[0]?.total_billed) || 0;
    const totalPaid = Number(paySumRows[0]?.total_paid) || 0;
    const customerPendingBalance = round2(Math.max(0, totalBilled - totalPaid));

    if (payAmount > customerPendingBalance) {
      throw new Error(
        `Payment amount (Rs. ${payAmount}) cannot exceed customer's total pending balance (Rs. ${customerPendingBalance}).`
      );
    }

    // 3. Apply to specific bill OR oldest unpaid bills first
    let targetBillId = bill_id ? parseInt(bill_id, 10) : null;

    if (targetBillId) {
      // Specific Bill Payment
      const [billRows] = await connection.query(
        'SELECT * FROM bills WHERE id = ? AND customer_id = ? AND is_deleted = 0',
        [targetBillId, custId]
      );

      if (!billRows || billRows.length === 0) {
        throw new Error(`Bill #${targetBillId} does not exist for this customer.`);
      }

      const bill = billRows[0];
      const billPending = round2(bill.amount_pending);

      if (payAmount > billPending) {
        throw new Error(
          `Payment amount (Rs. ${payAmount}) exceeds the pending balance of bill ${bill.bill_no} (Rs. ${billPending}).`
        );
      }

      // Record Payment
      const [payResult] = await connection.query(
        `
        INSERT INTO payments (customer_id, bill_id, amount, payment_date, mode, note)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [custId, targetBillId, payAmount, payDate, mode, note || `Payment towards bill ${bill.bill_no}`]
      );

      // Recalculate bill
      const newPaid = round2(Number(bill.amount_paid) + payAmount);
      const newPending = round2(Math.max(0, Number(bill.total_amount) - newPaid));
      const newStatus = determineBillStatus(bill.total_amount, newPaid);

      await connection.query(
        'UPDATE bills SET amount_paid = ?, amount_pending = ?, status = ? WHERE id = ?',
        [newPaid, newPending, newStatus, targetBillId]
      );

      await connection.commit();

      return {
        id: payResult.insertId,
        customer_id: custId,
        bill_id: targetBillId,
        amount: payAmount,
        payment_date: payDate,
        mode,
        note
      };
    } else {
      // Apply to Oldest Unpaid Bills First (FIFO)
      const [unpaidBills] = await connection.query(
        `
        SELECT * FROM bills 
        WHERE customer_id = ? AND is_deleted = 0 AND amount_pending > 0
        ORDER BY bill_date ASC, id ASC
        `,
        [custId]
      );

      if (!unpaidBills || unpaidBills.length === 0) {
        throw new Error('Customer has no unpaid or partial bills to apply payments to.');
      }

      // Record primary payment entry
      const [payResult] = await connection.query(
        `
        INSERT INTO payments (customer_id, bill_id, amount, payment_date, mode, note)
        VALUES (?, NULL, ?, ?, ?, ?)
        `,
        [custId, payAmount, payDate, mode, note || 'Payment applied to oldest unpaid bills']
      );

      // Distribute amount across oldest bills
      let remainingToAllocate = payAmount;

      for (const bill of unpaidBills) {
        if (remainingToAllocate <= 0) break;

        const billPending = round2(bill.amount_pending);
        const amountForThisBill = round2(Math.min(remainingToAllocate, billPending));

        const newPaid = round2(Number(bill.amount_paid) + amountForThisBill);
        const newPending = round2(Math.max(0, Number(bill.total_amount) - newPaid));
        const newStatus = determineBillStatus(bill.total_amount, newPaid);

        await connection.query(
          'UPDATE bills SET amount_paid = ?, amount_pending = ?, status = ? WHERE id = ?',
          [newPaid, newPending, newStatus, bill.id]
        );

        remainingToAllocate = round2(remainingToAllocate - amountForThisBill);
      }

      await connection.commit();

      return {
        id: payResult.insertId,
        customer_id: custId,
        bill_id: null,
        amount: payAmount,
        payment_date: payDate,
        mode,
        note
      };
    }
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * List payments for customer or shop
 */
async function getPayments({ customerId, billId }) {
  let query = `
    SELECT 
      p.*,
      c.name AS customer_name,
      b.bill_no
    FROM payments p
    JOIN customers c ON c.id = p.customer_id
    LEFT JOIN bills b ON b.id = p.bill_id
    WHERE p.is_deleted = 0
  `;
  const params = [];

  if (customerId) {
    query += ' AND p.customer_id = ?';
    params.push(customerId);
  }
  if (billId) {
    query += ' AND p.bill_id = ?';
    params.push(billId);
  }

  query += ' ORDER BY p.payment_date DESC, p.id DESC';

  const [rows] = await db.query(query, params);
  return rows;
}

/**
 * Soft delete a payment and recalculate bill status
 */
async function deletePayment(id) {
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    const [existing] = await connection.query(
      'SELECT * FROM payments WHERE id = ? AND is_deleted = 0',
      [id]
    );

    if (!existing || existing.length === 0) {
      throw new Error(`Payment #${id} not found.`);
    }

    const payment = existing[0];

    // If attached to a specific bill, reduce the bill's paid amount
    if (payment.bill_id) {
      const [billRows] = await connection.query(
        'SELECT * FROM bills WHERE id = ?',
        [payment.bill_id]
      );
      if (billRows && billRows.length > 0) {
        const bill = billRows[0];
        const newPaid = round2(Math.max(0, Number(bill.amount_paid) - Number(payment.amount)));
        const newPending = round2(Math.max(0, Number(bill.total_amount) - newPaid));
        const newStatus = determineBillStatus(bill.total_amount, newPaid);

        await connection.query(
          'UPDATE bills SET amount_paid = ?, amount_pending = ?, status = ? WHERE id = ?',
          [newPaid, newPending, newStatus, bill.id]
        );
      }
    }

    // Soft delete payment
    await connection.query('UPDATE payments SET is_deleted = 1 WHERE id = ?', [id]);

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
  createPayment,
  getPayments,
  deletePayment
};
