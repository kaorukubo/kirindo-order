-- キリン堂 青果 発注・振分 DB

CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL,
  short_name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  order_unit INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS store_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  base_display INT NOT NULL DEFAULT 0,
  UNIQUE(store_id, product_id)
);

CREATE TABLE IF NOT EXISTS day_weather_coefficients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('日','月','火','水','木','金','土')),
  weather TEXT NOT NULL CHECK (weather IN ('晴れ','曇り','雨')),
  coefficient NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  UNIQUE(day_of_week, weather)
);

CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_date DATE NOT NULL,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sales_qty INT NOT NULL DEFAULT 0,
  loss_qty INT NOT NULL DEFAULT 0,
  UNIQUE(sale_date, store_id, product_id)
);

CREATE TABLE IF NOT EXISTS order_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_date DATE NOT NULL,
  order_date DATE NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  total_units INT NOT NULL DEFAULT 0,
  cases INT NOT NULL DEFAULT 0,
  remainder INT NOT NULL DEFAULT 0,
  alloc_store_1 INT NOT NULL DEFAULT 0,
  alloc_store_2 INT NOT NULL DEFAULT 0,
  alloc_store_3 INT NOT NULL DEFAULT 0,
  alloc_store_4 INT NOT NULL DEFAULT 0,
  loss_store_1 INT NOT NULL DEFAULT 0,
  loss_store_2 INT NOT NULL DEFAULT 0,
  loss_store_3 INT NOT NULL DEFAULT 0,
  loss_store_4 INT NOT NULL DEFAULT 0,
  weather TEXT,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weekly_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label_count INT NOT NULL DEFAULT 0,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(week_start, store_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_store_product ON sales(store_id, product_id);
CREATE INDEX IF NOT EXISTS idx_order_results_delivery ON order_results(delivery_date);
CREATE INDEX IF NOT EXISTS idx_weekly_labels_week ON weekly_labels(week_start);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_weather_coefficients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_stores" ON stores FOR SELECT USING (true);
CREATE POLICY "public_read_products" ON products FOR SELECT USING (true);
CREATE POLICY "public_read_store_products" ON store_products FOR SELECT USING (true);
CREATE POLICY "public_read_coefficients" ON day_weather_coefficients FOR SELECT USING (true);
CREATE POLICY "public_read_sales" ON sales FOR SELECT USING (true);
CREATE POLICY "public_read_orders" ON order_results FOR SELECT USING (true);
CREATE POLICY "public_read_labels" ON weekly_labels FOR SELECT USING (true);

CREATE POLICY "public_write_sales" ON sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_write_orders" ON order_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_write_labels" ON weekly_labels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_write_stores" ON stores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_write_products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_write_store_products" ON store_products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_write_coefficients" ON day_weather_coefficients FOR ALL USING (true) WITH CHECK (true);
