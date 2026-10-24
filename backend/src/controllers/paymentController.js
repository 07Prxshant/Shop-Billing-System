const paymentService = require('../services/paymentService');

async function createPayment(req, res, next) {
  try {
    const { customerId, customer_id, billId, bill_id, amount, date, payment_date, mode, note } = req.body;

    const payment = await paymentService.createPayment({
      customer_id: customerId || customer_id,
      bill_id: billId || bill_id || null,
      amount: Number(amount),
      payment_date: date || payment_date,
      mode: mode || 'CASH',
      note: note || ''
    });

    return res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: payment
    });
  } catch (err) {
    next(err);
  }
}

async function getPayments(req, res, next) {
  try {
    const { customerId, billId } = req.query;
    const payments = await paymentService.getPayments({ customerId, billId });

    return res.json({
      success: true,
      data: payments
    });
  } catch (err) {
    next(err);
  }
}

async function deletePayment(req, res, next) {
  try {
    const { id } = req.params;
    await paymentService.deletePayment(id);

    return res.json({
      success: true,
      message: 'Payment deleted and bill status recalculated successfully'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createPayment,
  getPayments,
  deletePayment
};
