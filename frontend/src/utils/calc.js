/**
 * Frontend calculation logic mirroring backend formulas
 */

export function round2(num) {
  return Math.round((Number(num) || 0) * 100) / 100;
}

export function calculateLineAmount(qty, rate) {
  return round2((Number(qty) || 0) * (Number(rate) || 0));
}

export function calculateBillTotals(items = [], discount = 0, amountPaid = 0) {
  let subtotal = 0;

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

  // Tax per item proportional to discount
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
