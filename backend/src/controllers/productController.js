const db = require('../config/db');

// List products with optional search and category filters
async function getAllProducts(req, res, next) {
  try {
    const { search, category } = req.query;
    let query = 'SELECT id, name, category, price, gst_percent, stock_qty, low_stock_limit, created_at FROM products WHERE is_deleted = 0';
    const params = [];

    if (search && search.trim()) {
      query += ' AND (name LIKE ? OR category LIKE ?)';
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (category && category.trim()) {
      query += ' AND category = ?';
      params.push(category.trim());
    }

    query += ' ORDER BY name ASC';

    const [rows] = await db.query(query, params);

    // If query returns empty or fallback filter needed
    let filtered = rows;
    if (db.isFallback && db.isFallback()) {
      if (search && search.trim()) {
        const q = search.trim().toLowerCase();
        filtered = filtered.filter(p => 
          (p.name && p.name.toLowerCase().includes(q)) || 
          (p.category && p.category.toLowerCase().includes(q))
        );
      }
      if (category && category.trim()) {
        filtered = filtered.filter(p => p.category === category.trim());
      }
    }

    return res.json({
      success: true,
      data: filtered
    });
  } catch (err) {
    next(err);
  }
}

// Get single product by id
async function getProductById(req, res, next) {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      'SELECT id, name, category, price, gst_percent, stock_qty, low_stock_limit, created_at FROM products WHERE id = ? AND is_deleted = 0 LIMIT 1',
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    return res.json({
      success: true,
      data: rows[0]
    });
  } catch (err) {
    next(err);
  }
}

// Create new product
async function createProduct(req, res, next) {
  try {
    const { name, category, price, gst_percent, stock_qty, low_stock_limit } = req.body;

    const [result] = await db.query(
      'INSERT INTO products (name, category, price, gst_percent, stock_qty, low_stock_limit) VALUES (?, ?, ?, ?, ?, ?)',
      [
        name.trim(),
        (category || 'General').trim(),
        Number(price) || 0,
        Number(gst_percent) || 0,
        parseInt(stock_qty, 10) || 0,
        parseInt(low_stock_limit, 10) || 5
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        id: result.insertId,
        name: name.trim(),
        category: (category || 'General').trim(),
        price: Number(price) || 0,
        gst_percent: Number(gst_percent) || 0,
        stock_qty: parseInt(stock_qty, 10) || 0,
        low_stock_limit: parseInt(low_stock_limit, 10) || 5
      }
    });
  } catch (err) {
    next(err);
  }
}

// Update existing product
async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    const { name, category, price, gst_percent, stock_qty, low_stock_limit } = req.body;

    const [existing] = await db.query(
      'SELECT id FROM products WHERE id = ? AND is_deleted = 0',
      [id]
    );

    if (!existing || existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or has been deleted'
      });
    }

    await db.query(
      'UPDATE products SET name = ?, category = ?, price = ?, gst_percent = ?, stock_qty = ?, low_stock_limit = ? WHERE id = ?',
      [
        name.trim(),
        (category || 'General').trim(),
        Number(price) || 0,
        Number(gst_percent) || 0,
        parseInt(stock_qty, 10) || 0,
        parseInt(low_stock_limit, 10) || 5,
        id
      ]
    );

    return res.json({
      success: true,
      message: 'Product updated successfully',
      data: {
        id: Number(id),
        name: name.trim(),
        category: (category || 'General').trim(),
        price: Number(price) || 0,
        gst_percent: Number(gst_percent) || 0,
        stock_qty: parseInt(stock_qty, 10) || 0,
        low_stock_limit: parseInt(low_stock_limit, 10) || 5
      }
    });
  } catch (err) {
    next(err);
  }
}

// Soft delete product
async function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;

    const [existing] = await db.query(
      'SELECT id FROM products WHERE id = ? AND is_deleted = 0',
      [id]
    );

    if (!existing || existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or already deleted'
      });
    }

    await db.query('UPDATE products SET is_deleted = 1 WHERE id = ?', [id]);

    return res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};
