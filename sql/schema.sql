-- Coral Gold — database schema (MySQL / MariaDB)
-- Import once via Hostinger phpMyAdmin, or:  mysql -u USER -p DBNAME < sql/schema.sql

SET NAMES utf8mb4;

-- ---------------------------------------------------------------- admins
CREATE TABLE IF NOT EXISTS admins (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username       VARCHAR(64)  NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  name           VARCHAR(120) NOT NULL DEFAULT '',
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admins_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------ categories
-- A category is nothing but a name (batch 3, item 1). The slug is derived
-- from it for stable URLs and is not separately editable.
CREATE TABLE IF NOT EXISTS categories (
  id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name  VARCHAR(120) NOT NULL,
  slug  VARCHAR(140) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------- products
-- design_number / jewel_code / weights are nullable: existing catalogue
-- photos were imported before that data was supplied, and the admin panel
-- fills them in. The public catalogue never exposes jewel_code or weights.
-- jewel_code is the natural key the ERP export upserts on, so it is unique.
-- It is NULL (not '') when absent, because MySQL permits many NULLs in a
-- unique index — so hand-added products without a code still save.
CREATE TABLE IF NOT EXISTS products (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id    INT UNSIGNED     NULL,
  name           VARCHAR(160) NOT NULL DEFAULT '',
  design_number  VARCHAR(80)      NULL,
  jewel_code     VARCHAR(80)      NULL,
  gross_weight   DECIMAL(10,3)    NULL,
  net_weight     DECIMAL(10,3)    NULL,
  quantity       INT UNSIGNED     NULL,
  description    TEXT             NULL,
  image_path     VARCHAR(255) NOT NULL DEFAULT '',
  featured       TINYINT(1)   NOT NULL DEFAULT 0,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_jewel_code (jewel_code),
  KEY idx_products_category_active (category_id, is_active),
  KEY idx_products_active (is_active),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id)
    REFERENCES categories (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------- parties
-- Wholesaler accounts. Created by Admin only — no public self-registration,
-- and the party cannot change its own Party ID or password (batch 3,
-- item 2), so there is no self-service state to track here.
CREATE TABLE IF NOT EXISTS parties (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  party_code     VARCHAR(64)  NOT NULL,          -- the "Party ID" used to log in
  password_hash  VARCHAR(255) NOT NULL,
  company_name   VARCHAR(160) NOT NULL,
  phone          VARCHAR(40)  NOT NULL DEFAULT '',
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_parties_code (party_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------ cart items
-- The in-progress order list, saved against the account so selections
-- survive navigation and re-login (SRS 4.4).
CREATE TABLE IF NOT EXISTS cart_items (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  party_id    INT UNSIGNED NOT NULL,
  product_id  INT UNSIGNED NOT NULL,
  quantity    INT UNSIGNED NOT NULL DEFAULT 1,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cart_party_product (party_id, product_id),
  CONSTRAINT fk_cart_party FOREIGN KEY (party_id)
    REFERENCES parties (id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_product FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------ quotations
CREATE TABLE IF NOT EXISTS quotations (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  quotation_no  VARCHAR(40)  NOT NULL,
  party_id      INT UNSIGNED NOT NULL,
  item_count    INT UNSIGNED NOT NULL DEFAULT 0,
  total_qty     INT UNSIGNED NOT NULL DEFAULT 0,
  notes         TEXT             NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_quotations_no (quotation_no),
  KEY idx_quotations_party (party_id),
  KEY idx_quotations_created (created_at),
  CONSTRAINT fk_quotations_party FOREIGN KEY (party_id)
    REFERENCES parties (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------- quotation items
-- Product details are snapshotted at generation time so a past quotation
-- still reads correctly after the catalogue is edited. No price column —
-- pricing is agreed outside the system (SRS 4.5).
CREATE TABLE IF NOT EXISTS quotation_items (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  quotation_id   INT UNSIGNED NOT NULL,
  product_id     INT UNSIGNED     NULL,
  name           VARCHAR(160) NOT NULL DEFAULT '',
  design_number  VARCHAR(80)      NULL,
  jewel_code     VARCHAR(80)      NULL,
  gross_weight   DECIMAL(10,3)    NULL,
  net_weight     DECIMAL(10,3)    NULL,
  quantity       INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_qitems_quotation (quotation_id),
  CONSTRAINT fk_qitems_quotation FOREIGN KEY (quotation_id)
    REFERENCES quotations (id) ON DELETE CASCADE,
  CONSTRAINT fk_qitems_product FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------- login attempts
-- Backs the throttling required by SRS 4.1.
CREATE TABLE IF NOT EXISTS login_attempts (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  scope        VARCHAR(16)  NOT NULL,   -- 'party' or 'admin'
  identifier   VARCHAR(64)  NOT NULL,   -- attempted username, lowercased
  ip_address   VARCHAR(45)  NOT NULL DEFAULT '',
  succeeded    TINYINT(1)   NOT NULL DEFAULT 0,
  attempted_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_attempts_lookup (scope, identifier, attempted_at),
  KEY idx_attempts_ip (ip_address, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------- site content
-- Editable landing-page copy and contact details (SRS 5.5).
CREATE TABLE IF NOT EXISTS site_content (
  content_key  VARCHAR(80)  NOT NULL,
  content_value TEXT        NOT NULL,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (content_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
