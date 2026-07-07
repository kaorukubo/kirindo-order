-- 汎用設定テーブル（係数など JSON で保持）
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_settings" ON app_settings;
DROP POLICY IF EXISTS "public_write_settings" ON app_settings;
CREATE POLICY "public_read_settings" ON app_settings FOR SELECT USING (true);
CREATE POLICY "public_write_settings" ON app_settings FOR ALL USING (true) WITH CHECK (true);
