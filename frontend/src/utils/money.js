/**
 * Format amounts into currency representation
 * e.g. Rs. 1,234.50
 */
export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return `Rs. ${num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function round2(num) {
  return Math.round((Number(num) || 0) * 100) / 100;
}
