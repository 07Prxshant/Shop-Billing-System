-- Shop Billing System Seed Data
-- Run after schema.sql

USE shop_billing;

-- 1. Admin User (Password: admin123)
-- bcrypt hash for 'admin123'
INSERT INTO users (id, name, email, password_hash, role)
VALUES (1, 'Shop Admin', 'admin@shop.com', '$2b$10$u4M0qE8ZgH9j1i2K3l4M5.Jk9aBvC6dE7fG8hI9jK0l1m2n3o4p5q', 'admin')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 2. Default Walk-in Customer (id: 1)
INSERT INTO customers (id, name, phone, address, is_deleted)
VALUES (1, 'Walk-in', '0000000000', 'Direct Counter Sales', 0)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 3. 5 Sample Customers
INSERT INTO customers (id, name, phone, address, is_deleted) VALUES
(2, 'Rahul Sharma', '9876543210', 'Flat 101, Sunshine Heights, Mumbai', 0),
(3, 'Priya Patel', '9823456789', 'B-12, Green Park Society, Pune', 0),
(4, 'Amit Verma', '9123456780', 'Shop 4, Market Yard, Nashik', 0),
(5, 'Sneha Kulkarni', '9988776655', 'Plot 55, Model Colony, Nagpur', 0),
(6, 'Vikram Singh', '9711223344', '22 Rajouri Garden, New Delhi', 0)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 4. 10 Sample Products
INSERT INTO products (id, name, category, price, gst_percent, stock_qty, low_stock_limit, is_deleted) VALUES
(1, 'Basmati Rice (1kg)', 'Grocery', 110.00, 5.00, 50, 10, 0),
(2, 'Refined Sunflower Oil (1L)', 'Grocery', 145.00, 5.00, 35, 8, 0),
(3, 'Whole Wheat Atta (5kg)', 'Grocery', 230.00, 0.00, 40, 10, 0),
(4, 'Tata Tea Gold (500g)', 'Beverages', 260.00, 5.00, 25, 5, 0),
(5, 'Cadbury Dairy Milk Silk', 'Confectionery', 85.00, 18.00, 60, 15, 0),
(6, 'Dettol Antiseptic Liquid (250ml)', 'Personal Care', 125.00, 12.00, 3, 5, 0), -- Low stock alert
(7, 'Surf Excel Detergent (1kg)', 'Household', 140.00, 18.00, 20, 5, 0),
(8, 'Amul Butter (500g)', 'Dairy', 275.00, 12.00, 18, 5, 0),
(9, 'Colgate Total Toothpaste (150g)', 'Personal Care', 95.00, 12.00, 4, 10, 0), -- Low stock alert
(10, 'Aashirvaad Salt (1kg)', 'Grocery', 28.00, 0.00, 80, 15, 0)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 5. Shop Settings
INSERT INTO settings (id, shop_name, address, phone, gst_number, invoice_footer)
VALUES (1, 'Vikas Super Market', '124 Main Street, Commercial Hub, Mumbai - 400001', '022-28471920', 'GSTIN27AABCU9603R1ZM', 'Thank you for shopping with us! Goods once sold can be exchanged within 7 days.')
ON DUPLICATE KEY UPDATE shop_name=VALUES(shop_name);

-- 6. Sample Bills
-- Bill 1: Rahul Sharma (Partial Payment)
INSERT INTO bills (id, bill_no, customer_id, bill_date, subtotal, discount, tax, total_amount, amount_paid, amount_pending, status, payment_mode, notes, is_deleted)
VALUES (1, 'INV-0001', 2, CURDATE() - INTERVAL 10 DAY, 595.00, 25.00, 28.50, 598.50, 300.00, 298.50, 'PARTIAL', 'CASH', 'Regular monthly essentials', 0)
ON DUPLICATE KEY UPDATE bill_no=VALUES(bill_no);

INSERT INTO bill_items (id, bill_id, product_id, product_name, qty, rate, gst_percent, amount) VALUES
(1, 1, 1, 'Basmati Rice (1kg)', 2, 110.00, 5.00, 220.00),
(2, 1, 2, 'Refined Sunflower Oil (1L)', 1, 145.00, 5.00, 145.00),
(3, 1, 3, 'Whole Wheat Atta (5kg)', 1, 230.00, 0.00, 230.00)
ON DUPLICATE KEY UPDATE product_name=VALUES(product_name);

-- Initial payment for Bill 1
INSERT INTO payments (id, customer_id, bill_id, amount, payment_date, mode, note, is_deleted)
VALUES (1, 2, 1, 300.00, CURDATE() - INTERVAL 10 DAY, 'CASH', 'Initial deposit on bill INV-0001', 0)
ON DUPLICATE KEY UPDATE amount=VALUES(amount);

-- Bill 2: Priya Patel (Fully Paid)
INSERT INTO bills (id, bill_no, customer_id, bill_date, subtotal, discount, tax, total_amount, amount_paid, amount_pending, status, payment_mode, notes, is_deleted)
VALUES (2, 'INV-0002', 3, CURDATE() - INTERVAL 5 DAY, 535.00, 0.00, 48.00, 583.00, 583.00, 0.00, 'PAID', 'UPI', 'Paid via PhonePe', 0)
ON DUPLICATE KEY UPDATE bill_no=VALUES(bill_no);

INSERT INTO bill_items (id, bill_id, product_id, product_name, qty, rate, gst_percent, amount) VALUES
(4, 2, 4, 'Tata Tea Gold (500g)', 1, 260.00, 5.00, 260.00),
(5, 2, 8, 'Amul Butter (500g)', 1, 275.00, 12.00, 275.00)
ON DUPLICATE KEY UPDATE product_name=VALUES(product_name);

INSERT INTO payments (id, customer_id, bill_id, amount, payment_date, mode, note, is_deleted)
VALUES (2, 3, 2, 583.00, CURDATE() - INTERVAL 5 DAY, 'UPI', 'Paid full amount for INV-0002', 0)
ON DUPLICATE KEY UPDATE amount=VALUES(amount);

-- Bill 3: Rahul Sharma (Unpaid second bill)
INSERT INTO bills (id, bill_no, customer_id, bill_date, subtotal, discount, tax, total_amount, amount_paid, amount_pending, status, payment_mode, notes, is_deleted)
VALUES (3, 'INV-0003', 2, CURDATE() - INTERVAL 2 DAY, 310.00, 10.00, 42.30, 342.30, 0.00, 342.30, 'UNPAID', 'CREDIT', 'Added to account', 0)
ON DUPLICATE KEY UPDATE bill_no=VALUES(bill_no);

INSERT INTO bill_items (id, bill_id, product_id, product_name, qty, rate, gst_percent, amount) VALUES
(6, 3, 5, 'Cadbury Dairy Milk Silk', 2, 85.00, 18.00, 170.00),
(7, 3, 7, 'Surf Excel Detergent (1kg)', 1, 140.00, 18.00, 140.00)
ON DUPLICATE KEY UPDATE product_name=VALUES(product_name);
