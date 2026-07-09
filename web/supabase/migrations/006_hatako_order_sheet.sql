-- 畑光発注書への掲載フラグ（商品ごと）

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS hatako_order_sheet BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN products.hatako_order_sheet IS 'true=畑光向けExcel発注書の発注一覧に掲載';
