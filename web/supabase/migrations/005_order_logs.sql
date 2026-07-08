-- 発注操作ログ（スナップショット）・テスト発注ログ

CREATE TABLE IF NOT EXISTS order_operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_test BOOLEAN NOT NULL DEFAULT false,
  summary TEXT NOT NULL DEFAULT '',
  snapshot JSONB NOT NULL,
  saved_count INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS test_order_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_log_id UUID REFERENCES order_operation_logs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivery_date DATE NOT NULL,
  order_date DATE NOT NULL,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_operation_logs_created ON order_operation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_operation_logs_test ON order_operation_logs(is_test);

ALTER TABLE order_operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_order_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_order_logs" ON order_operation_logs FOR SELECT USING (true);
CREATE POLICY "public_write_order_logs" ON order_operation_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_read_test_logs" ON test_order_logs FOR SELECT USING (true);
CREATE POLICY "public_write_test_logs" ON test_order_logs FOR ALL USING (true) WITH CHECK (true);
