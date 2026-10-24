const db = require('../config/db');
const { round2 } = require('../utils/calc');

async function getDashboardSummary(req, res, next) {
  try {
    // 1. Sales metrics
    const [salesRows] = await db.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN bill_date = CURDATE() THEN total_amount ELSE 0 END), 0) AS today_sales,
        COALESCE(SUM(CASE WHEN bill_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01') THEN total_amount ELSE 0 END), 0) AS month_sales,
        COALESCE(SUM(CASE WHEN customer_id != 1 THEN amount_pending ELSE 0 END), 0) AS total_pending_dues
      FROM bills
      WHERE is_deleted = 0
    `);

    const stats = salesRows[0] || { today_sales: 0, month_sales: 0, total_pending_dues: 0 };

    // 2. Top 5 customers by total spending
    const [topCustomers] = await db.query(`
      SELECT 
        b.customer_id,
        c.name,
        c.phone,
        SUM(b.total_amount) AS total_spend,
        COUNT(b.id) AS bill_count
      FROM bills b
      JOIN customers c ON c.id = b.customer_id
      WHERE b.is_deleted = 0 AND b.customer_id != 1
      GROUP BY b.customer_id
      ORDER BY total_spend DESC
      LIMIT 5
    `);

    // 3. Top 5 products by revenue
    const [topProducts] = await db.query(`
      SELECT 
        bi.product_id,
        bi.product_name,
        SUM(bi.qty) AS total_qty,
        SUM(bi.amount) AS total_sales
      FROM bill_items bi
      JOIN bills b ON b.id = bi.bill_id
      WHERE b.is_deleted = 0
      GROUP BY bi.product_id
      ORDER BY total_sales DESC
      LIMIT 5
    `);

    // 4. Low stock products alert list
    const [lowStock] = await db.query(`
      SELECT id, name, category, price, stock_qty, low_stock_limit
      FROM products
      WHERE is_deleted = 0 AND stock_qty <= low_stock_limit
      ORDER BY stock_qty ASC
      LIMIT 6
    `);

    // 5. Recent 7 days sales data for dashboard mini-chart
    const [recentDays] = await db.query(`
      SELECT 
        bill_date AS label,
        SUM(total_amount) AS total,
        COUNT(id) AS count
      FROM bills
      WHERE is_deleted = 0 AND bill_date >= CURDATE() - INTERVAL 6 DAY
      GROUP BY bill_date
      ORDER BY bill_date ASC
    `);

    return res.json({
      success: true,
      data: {
        today_sales: round2(stats.today_sales),
        month_sales: round2(stats.month_sales),
        total_pending_dues: round2(stats.total_pending_dues),
        top_customers: topCustomers,
        top_products: topProducts,
        low_stock_products: lowStock,
        recent_sales: recentDays
      }
    });
  } catch (err) {
    next(err);
  }
}

async function getSalesChart(req, res, next) {
  try {
    const { from, to, groupBy } = req.query;

    const fromDate = from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const toDate = to || new Date().toISOString().split('T')[0];
    const isMonthly = groupBy === 'month';

    let query;
    if (isMonthly) {
      query = `
        SELECT 
          DATE_FORMAT(bill_date, '%Y-%m') AS label,
          SUM(total_amount) AS total,
          SUM(amount_paid) AS paid,
          SUM(amount_pending) AS pending,
          COUNT(id) AS count
        FROM bills
        WHERE is_deleted = 0 AND bill_date BETWEEN ? AND ?
        GROUP BY label
        ORDER BY label ASC
      `;
    } else {
      query = `
        SELECT 
          bill_date AS label,
          SUM(total_amount) AS total,
          SUM(amount_paid) AS paid,
          SUM(amount_pending) AS pending,
          COUNT(id) AS count
        FROM bills
        WHERE is_deleted = 0 AND bill_date BETWEEN ? AND ?
        GROUP BY bill_date
        ORDER BY bill_date ASC
      `;
    }

    const [rows] = await db.query(query, [fromDate, toDate]);

    return res.json({
      success: true,
      data: rows
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboardSummary,
  getSalesChart
};
