-- DukaanSaathi - Smart Business Management System
-- MySQL 8+ Relational Database Schema

CREATE DATABASE IF NOT EXISTS dukaansaathi
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE dukaansaathi;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    owner_name VARCHAR(120) NOT NULL,
    email VARCHAR(191) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Businesses Table (Business-level isolation)
CREATE TABLE IF NOT EXISTS businesses (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    store_name VARCHAR(150) NOT NULL,
    business_type VARCHAR(100) NOT NULL DEFAULT 'Kirana / General Store',
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_businesses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_businesses_user (user_id)
) ENGINE=InnoDB;

-- 3. Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    business_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_categories_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    UNIQUE KEY uq_category_business_name (business_id, name)
) ENGINE=InnoDB;

-- 4. Products Table
CREATE TABLE IF NOT EXISTS products (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    business_id BIGINT UNSIGNED NOT NULL,
    category_id BIGINT UNSIGNED NULL,
    name VARCHAR(160) NOT NULL,
    sku VARCHAR(64) NOT NULL,
    description TEXT NULL,
    purchase_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    selling_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    available_quantity INT NOT NULL DEFAULT 0,
    min_stock_level INT NOT NULL DEFAULT 5,
    is_archived TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_products_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    UNIQUE KEY uq_product_business_sku (business_id, sku),
    INDEX idx_products_business_archived (business_id, is_archived),
    INDEX idx_products_name (business_id, name)
) ENGINE=InnoDB;

-- 5. Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    business_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    contact VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_suppliers_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    INDEX idx_suppliers_business (business_id)
) ENGINE=InnoDB;

-- 6. Purchases Table
CREATE TABLE IF NOT EXISTS purchases (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    business_id BIGINT UNSIGNED NOT NULL,
    supplier_id BIGINT UNSIGNED NULL,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    payment_status ENUM('Paid', 'Pending', 'Partial') NOT NULL DEFAULT 'Paid',
    purchase_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_purchases_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
    INDEX idx_purchases_business_date (business_id, purchase_date)
) ENGINE=InnoDB;

-- 7. Purchase Items Table
CREATE TABLE IF NOT EXISTS purchase_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    purchase_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    quantity INT NOT NULL,
    unit_cost DECIMAL(12, 2) NOT NULL,
    total_cost DECIMAL(12, 2) NOT NULL,
    CONSTRAINT fk_purchase_items_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
    CONSTRAINT fk_purchase_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    INDEX idx_purchase_items_product (product_id)
) ENGINE=InnoDB;

-- 8. Inventory Batches Table (FIFO Cost Layers)
CREATE TABLE IF NOT EXISTS inventory_batches (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    business_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    purchase_item_id BIGINT UNSIGNED NULL,
    initial_quantity INT NOT NULL,
    remaining_quantity INT NOT NULL,
    unit_cost DECIMAL(12, 2) NOT NULL,
    received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_batches_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    CONSTRAINT fk_batches_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_batches_purchase_item FOREIGN KEY (purchase_item_id) REFERENCES purchase_items(id) ON DELETE SET NULL,
    INDEX idx_batches_fifo_lookup (business_id, product_id, remaining_quantity, received_at, id)
) ENGINE=InnoDB;

-- 9. Sales Table
CREATE TABLE IF NOT EXISTS sales (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    business_id BIGINT UNSIGNED NOT NULL,
    invoice_number VARCHAR(50) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_cogs DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    gross_profit DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    payment_method ENUM('Cash', 'UPI', 'Card', 'Other') NOT NULL DEFAULT 'Cash',
    customer_name VARCHAR(120) NULL,
    sale_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_sales_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    UNIQUE KEY uq_sales_business_invoice (business_id, invoice_number),
    INDEX idx_sales_business_date (business_id, sale_date)
) ENGINE=InnoDB;

-- 10. Sale Items Table
CREATE TABLE IF NOT EXISTS sale_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sale_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    quantity INT NOT NULL,
    selling_price DECIMAL(12, 2) NOT NULL,
    line_total DECIMAL(12, 2) NOT NULL,
    cogs DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    gross_profit DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    CONSTRAINT fk_sale_items_sale FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    CONSTRAINT fk_sale_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    INDEX idx_sale_items_product (product_id)
) ENGINE=InnoDB;

-- 11. Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    business_id BIGINT UNSIGNED NOT NULL,
    category ENUM(
        'Electricity',
        'Shop Rent',
        'Transportation',
        'Employee Salary',
        'Packaging',
        'Maintenance',
        'Internet',
        'Marketing',
        'Other'
    ) NOT NULL DEFAULT 'Other',
    amount DECIMAL(12, 2) NOT NULL,
    description VARCHAR(255) NOT NULL,
    expense_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_expenses_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    INDEX idx_expenses_business_date (business_id, expense_date),
    INDEX idx_expenses_category (business_id, category)
) ENGINE=InnoDB;

-- 12. Stock Movements Audit Log Table
CREATE TABLE IF NOT EXISTS stock_movements (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    business_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    movement_type ENUM('PURCHASE', 'SALE', 'ADJUSTMENT', 'INITIAL') NOT NULL,
    quantity_change INT NOT NULL,
    reference_type VARCHAR(50) NULL,
    reference_id BIGINT UNSIGNED NULL,
    notes VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_movements_business FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    CONSTRAINT fk_movements_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_movements_business_product (business_id, product_id, created_at)
) ENGINE=InnoDB;
