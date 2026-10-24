const db = require('../config/db');

async function getSettings(req, res, next) {
  try {
    const [rows] = await db.query('SELECT * FROM settings WHERE id = 1 LIMIT 1');
    const settings = rows[0] || {
      id: 1,
      shop_name: 'Vikas Super Market',
      address: '124 Main Street, Commercial Hub, Mumbai - 400001',
      phone: '022-28471920',
      gst_number: 'GSTIN27AABCU9603R1ZM',
      invoice_footer: 'Thank you for shopping with us! Visit again.'
    };

    return res.json({
      success: true,
      data: settings
    });
  } catch (err) {
    next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    const { shop_name, address, phone, gst_number, invoice_footer } = req.body;

    await db.query(
      `
      INSERT INTO settings (id, shop_name, address, phone, gst_number, invoice_footer)
      VALUES (1, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        shop_name = VALUES(shop_name),
        address = VALUES(address),
        phone = VALUES(phone),
        gst_number = VALUES(gst_number),
        invoice_footer = VALUES(invoice_footer)
      `,
      [
        (shop_name || 'My Shop').trim(),
        (address || '').trim(),
        (phone || '').trim(),
        (gst_number || '').trim(),
        (invoice_footer || '').trim()
      ]
    );

    return res.json({
      success: true,
      message: 'Shop settings updated successfully',
      data: {
        id: 1,
        shop_name,
        address,
        phone,
        gst_number,
        invoice_footer
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSettings,
  updateSettings
};
