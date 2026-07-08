-- 商品ラベル情報（キリン堂販売用）

CREATE TABLE IF NOT EXISTS product_label_info (
  product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  unit_price INT,
  barcode TEXT,
  seller TEXT DEFAULT 'イサタン食品株式会社',
  processor TEXT DEFAULT '',
  origin TEXT DEFAULT '',
  net_weight TEXT DEFAULT '',
  storage_method TEXT DEFAULT '要冷蔵（10℃以下）',
  ingredients TEXT DEFAULT '',
  field_visibility JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE product_label_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_product_label_info" ON product_label_info FOR SELECT USING (true);
CREATE POLICY "public_write_product_label_info" ON product_label_info FOR ALL USING (true) WITH CHECK (true);
