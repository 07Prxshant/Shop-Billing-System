-- Shop Billing System Database Schema
-- MySQL 8.0+

CREATE DATABASE IF NOT EXISTS shop_billing;
USE shop_billing;

-- Drop tables in reverse order of foreign key dependencies
DROP TABLE IF EXISTS bill_items;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS bills;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS settings;

-- 1. Users Table
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','cashier') DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Customers Table
-- Customer id 1 is reserved for 'Walk-in'
CREATE TABLE customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(20),
  address VARCHAR(255),
  is_deleted TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Products Table
CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(80),
  price DECIMAL(10,2) NOT NULL,
  gst_percent DECIMAL(5,2) DEFAULT 0,
  stock_qty INT DEFAULT 0,
  low_stock_limit INT DEFAULT 5,
  is_deleted TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Bills Table
CREATE TABLE bills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bill_no VARCHAR(20) NOT NULL UNIQUE,
  customer_id INT NOT NULL,
  bill_date DATE NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) DEFAULT 0,
  tax DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  amount_paid DECIMAL(12,2) DEFAULT 0,
  amount_pending DECIMAL(12,2) NOT NULL,
  status ENUM('PAID','PARTIAL','UNPAID') NOT NULL,
  payment_mode ENUM('CASH','UPI','CARD','CREDIT') DEFAULT 'CASH',
  notes VARCHAR(255),
  is_deleted TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  INDEX idx_bill_customer_date (customer_id, bill_date)
);

-- 5. Bill Items Table
CREATE TABLE bill_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bill_id INT NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  qty INT NOT NULL,
  rate DECIMAL(10,2) NOT NULL,
  gst_percent DECIMAL(5,2) DEFAULT 0,
  amount DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 6. Payments Table
CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  bill_id INT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  mode ENUM('CASH','UPI','CARD') DEFAULT 'CASH',
  note VARCHAR(255),
  is_deleted TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (bill_id) REFERENCES bills(id),
  INDEX idx_payment_customer (customer_id)
);

-- 7. Settings Table
CREATE TABLE settings (
  id INT PRIMARY KEY DEFAULT 1,
  shop_name VARCHAR(150),
  address VARCHAR(255),
  phone VARCHAR(20),
  gst_number VARCHAR(30),
  invoice_footer VARCHAR(255)
);
