/**
 * Generates the next sequential bill number (e.g. INV-0001, INV-0002)
 */

async function generateNextBillNo(connectionOrPool) {
  const [rows] = await connectionOrPool.query(
    'SELECT bill_no FROM bills ORDER BY id DESC LIMIT 1'
  );

  if (!rows || rows.length === 0 || !rows[0].bill_no) {
    return 'INV-0001';
  }

  const lastBillNo = rows[0].bill_no; // e.g. "INV-0042"
  const match = lastBillNo.match(/INV-(\d+)/i);
  if (!match) {
    return 'INV-0001';
  }

  const nextNumber = parseInt(match[1], 10) + 1;
  const padded = String(nextNumber).padStart(4, '0');
  return `INV-${padded}`;
}

module.exports = {
  generateNextBillNo
};
