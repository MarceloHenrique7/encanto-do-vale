PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  short_label TEXT NOT NULL,
  display_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  image_src TEXT NOT NULL DEFAULT '',
  is_featured INTEGER NOT NULL DEFAULT 0,
  is_promo INTEGER NOT NULL DEFAULT 0,
  primary_category_label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_categories (
  product_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  PRIMARY KEY (product_id, category_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);
