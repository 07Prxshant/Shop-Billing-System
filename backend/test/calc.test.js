const test = require('node:test');
const assert = require('node:assert/strict');
const {
  round2,
  calculateLineAmount,
  calculateBillTotals,
  determineBillStatus,
  calculateCustomerBalance
} = require('../src/utils/calc');

test('round2: rounds accurately to 2 decimal places', () => {
  assert.equal(round2(10.555), 10.56);
  assert.equal(round2(10.554), 10.55);
  assert.equal(round2(0), 0);
  assert.equal(round2(null), 0);
});

test('calculateLineAmount: qty * rate', () => {
  assert.equal(calculateLineAmount(3, 150), 450);
  assert.equal(calculateLineAmount(2.5, 100), 250);
  assert.equal(calculateLineAmount(0, 100), 0);
});

test('calculateBillTotals: subtotal, discount, GST tax, pending and status', () => {
  const items = [
    { qty: 2, rate: 100, gst_percent: 5 },  // line: 200, 5% GST
    { qty: 1, rate: 200, gst_percent: 18 }  // line: 200, 18% GST
  ];

  // Subtotal = 400. Discount = 50. Taxable = 350.
  // Discount ratio = 350/400 = 0.875
  // Item 1 after discount = 175 -> tax 5% = 8.75
  // Item 2 after discount = 175 -> tax 18% = 31.50
  // Total tax = 40.25
  // Total amount = 350 + 40.25 = 390.25
  const resultUnpaid = calculateBillTotals(items, 50, 0);
  assert.equal(resultUnpaid.subtotal, 400);
  assert.equal(resultUnpaid.discount, 50);
  assert.equal(resultUnpaid.tax, 40.25);
  assert.equal(resultUnpaid.total_amount, 390.25);
  assert.equal(resultUnpaid.amount_paid, 0);
  assert.equal(resultUnpaid.amount_pending, 390.25);
  assert.equal(resultUnpaid.status, 'UNPAID');

  // Partial payment of 200
  const resultPartial = calculateBillTotals(items, 50, 200);
  assert.equal(resultPartial.amount_paid, 200);
  assert.equal(resultPartial.amount_pending, 190.25);
  assert.equal(resultPartial.status, 'PARTIAL');

  // Full payment
  const resultPaid = calculateBillTotals(items, 50, 390.25);
  assert.equal(resultPaid.amount_paid, 390.25);
  assert.equal(resultPaid.amount_pending, 0);
  assert.equal(resultPaid.status, 'PAID');
});

test('determineBillStatus: status reflects paid and total', () => {
  assert.equal(determineBillStatus(500, 500), 'PAID');
  assert.equal(determineBillStatus(500, 250), 'PARTIAL');
  assert.equal(determineBillStatus(500, 0), 'UNPAID');
  assert.equal(determineBillStatus(0, 0), 'PAID');
});

test('calculateCustomerBalance: total billed minus total paid', () => {
  assert.equal(calculateCustomerBalance(1500, 1000), 500);
  assert.equal(calculateCustomerBalance(1500, 1500), 0);
  assert.equal(calculateCustomerBalance(0, 0), 0);
});
