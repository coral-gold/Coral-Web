-- Coral Gold Database Schema v2.0

CREATE TABLE IF NOT EXISTS categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category_id INT NOT NULL,
    design_number VARCHAR(50) NOT NULL UNIQUE,
    jewel_code VARCHAR(50) NOT NULL UNIQUE,
    gross_weight DECIMAL(8,3),
    net_weight DECIMAL(8,3),
    quantity INT DEFAULT 0,
    image_path VARCHAR(255),
    description TEXT,
    amount VARCHAR(50),
    is_featured TINYINT DEFAULT 0,
    active TINYINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    INDEX idx_category (category_id),
    INDEX idx_jewel_code (jewel_code),
    INDEX idx_featured (is_featured),
    INDEX idx_active (active)
);

-- Extra gallery photos beyond products.image_path, which stays the single
-- "primary" image used everywhere else (cards, PDFs, quotations, Excel
-- import) unchanged. This table only feeds the swipeable image preview
-- (Batch 21 item 1) — a product with none still shows fine as a
-- single-image gallery.
CREATE TABLE IF NOT EXISTS product_images (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    image_path VARCHAR(255) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_product (product_id)
);

-- Many-to-many product↔category. products.category_id remains the "primary"
-- category (used for Excel import, sort/display fallback); every category a
-- product belongs to — including the primary — also has a row here, so all
-- filtering/display code has one consistent source of truth to query.
CREATE TABLE IF NOT EXISTS product_categories (
    product_id INT NOT NULL,
    category_id INT NOT NULL,
    PRIMARY KEY (product_id, category_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_tags (
    product_id INT NOT NULL,
    tag_id INT NOT NULL,
    PRIMARY KEY (product_id, tag_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS parties (
    id INT PRIMARY KEY AUTO_INCREMENT,
    party_id VARCHAR(20) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    company_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    is_active TINYINT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cart_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    party_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    remark TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_party_product (party_id, product_id),
    FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_party (party_id)
);

CREATE TABLE IF NOT EXISTS quotations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    party_id INT NOT NULL,
    quotation_number VARCHAR(20) NOT NULL UNIQUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (party_id) REFERENCES parties(id),
    INDEX idx_party (party_id),
    INDEX idx_created (created_at)
);

CREATE TABLE IF NOT EXISTS quotation_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    quotation_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    gross_weight DECIMAL(8,3),
    net_weight DECIMAL(8,3),
    design_number VARCHAR(50),
    jewel_code VARCHAR(50),
    remark TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS content (
    id INT PRIMARY KEY AUTO_INCREMENT,
    key_name VARCHAR(50) NOT NULL UNIQUE,
    value LONGTEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Login sessions, persisted here (not in server memory) so an admin/party
-- stays logged in across app restarts and works correctly with multiple
-- worker processes. Also created lazily by server/sessionStore.js if missing.
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(128) PRIMARY KEY,
    data LONGTEXT NOT NULL,
    expires BIGINT NOT NULL,
    INDEX idx_expires (expires)
);

-- Default content values
INSERT IGNORE INTO content (key_name, value) VALUES
    ('home_hero_title', 'Premium Gold Jewellery'),
    ('home_hero_subtitle', 'Crafted with excellence for discerning wholesalers'),
    ('about_text', 'Coral Gold is a premier wholesale jewellery house specialising in handcrafted gold ornaments.'),
    ('contact_email', 'info@coralgold.in'),
    ('contact_phone', '+91 98765 43210'),
    ('contact_address', 'Mumbai, Maharashtra, India'),
    ('wholesaler_enabled', '1'),
    ('site_lock_enabled', '0'),
    ('site_lock_password_hash', ''),
    ('show_net_weight', '1'),
    ('show_gross_weight', '1'),
    ('show_amount', '1'),
    ('pdf_layout', 'grid2');
