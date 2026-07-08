-- 半日販売実績・祝祭日・指数分析

CREATE TABLE IF NOT EXISTS half_day_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_date DATE NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('am', 'pm')),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sales_qty INT NOT NULL DEFAULT 0,
  loss_qty INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sale_date, period, store_id, product_id)
);

CREATE TABLE IF NOT EXISTS holidays (
  holiday_date DATE PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'holidays-jp',
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_half_day_sales_date ON half_day_sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_holidays_year ON holidays(holiday_date);

ALTER TABLE half_day_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_half_day_sales" ON half_day_sales FOR SELECT USING (true);
CREATE POLICY "public_write_half_day_sales" ON half_day_sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_read_holidays" ON holidays FOR SELECT USING (true);
CREATE POLICY "public_write_holidays" ON holidays FOR ALL USING (true) WITH CHECK (true);
