/**
 * Core business calculation functions
 * These exact formulas must match between backend and frontend.
 */

// Round to 2 decimal places to prevent floating point inaccuracies
function round2(num) {
  return Math.round((Number(num) || 0) * 100) / 100;
}

/**
 * Calculate single item line amount
 * line_amount = qty * rate
 */
function calculateLineAmount(qty, rate) {
  return round2((Number(qty) || 0) * (Number(rate) || 0));
}

/**
 * Calculate totals for a bill given its items and discount
 * @param {Array} items - Array of { qty, rate, gst_percent }
 * @param {number} discount - Discount amount (flat value or calculated)
 * @param {number} amountPaid - Initial amount paid
 */
function calculateBillTotals(items = [], discount = 0, amountPaid = 0) {
  let subtotal = 0;
  
  // 1. Calculate line amounts and subtotal
  const processedItems = items.map(item => {
    const qty = Number(item.qty) || 0;
    const rate = Number(item.rate) || 0;
    const gstPercent = Number(item.gst_percent) || 0;
    const lineAmount = calculateLineAmount(qty, rate);
    subtotal += lineAmount;

    return {
      ...item,
      qty,
      rate,
      gst_percent: gstPercent,
      amount: lineAmount
    };
  });

  subtotal = round2(subtotal);
  const discountAmount = round2(Math.min(Number(discount) || 0, subtotal));
  const taxable = round2(Math.max(0, subtotal - discountAmount));

  // Calculate tax per item proportionally after discount
  // line_amount_after_discount = line_amount * (1 - discountAmount / subtotal)
  let totalTax = 0;
  const discountRatio = subtotal > 0 ? (subtotal - discountAmount) / subtotal : 1;

  processedItems.forEach(item => {
    const lineAfterDiscount = item.amount * discountRatio;
    const itemTax = lineAfterDiscount * (item.gst_percent / 100);
    totalTax += itemTax;
  });

  const tax = round2(totalTax);
  const totalAmount = round2(taxable + tax);
  const paid = round2(Math.min(Number(amountPaid) || 0, totalAmount));
  const amountPending = round2(Math.max(0, totalAmount - paid));

  // Determine status
  let status = 'UNPAID';
  if (amountPending === 0 && totalAmount > 0) {
    status = 'PAID';
  } else if (paid > 0 && amountPending > 0) {
    status = 'PARTIAL';
  } else if (totalAmount === 0) {
    status = 'PAID';
  }

  return {
    items: processedItems,
    subtotal,
    discount: discountAmount,
    tax,
    total_amount: totalAmount,
    amount_paid: paid,
    amount_pending: amountPending,
    status
  };
}

/**
 * Determine bill status from paid and pending amounts
 */
function determineBillStatus(totalAmount, amountPaid) {
  const total = round2(totalAmount);
  const paid = round2(amountPaid);
  const pending = round2(Math.max(0, total - paid));

  if (pending === 0) return 'PAID';
  if (paid > 0 && pending > 0) return 'PARTIAL';
  return 'UNPAID';
}

/**
 * Calculate customer balance from non-deleted bills and payments
 */
function calculateCustomerBalance(totalBilled, totalPaid) {
  return round2((Number(totalBilled) || 0) - (Number(totalPaid) || 0));
}

module.exports = {
  round2,
  calculateLineAmount,
  calculateBillTotals,
  determineBillStatus,
  calculateCustomerBalance
};
