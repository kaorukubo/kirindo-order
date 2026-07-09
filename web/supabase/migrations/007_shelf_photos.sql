-- 棚陳列写真（陳列前・陳列後）

CREATE TABLE IF NOT EXISTS shelf_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('before', 'after')),
  staff_name TEXT NOT NULL DEFAULT '',
  image_path TEXT NOT NULL,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shelf_photos_store ON shelf_photos(store_id, taken_at DESC);

ALTER TABLE shelf_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_shelf_photos" ON shelf_photos FOR SELECT USING (true);
CREATE POLICY "public_write_shelf_photos" ON shelf_photos FOR ALL USING (true) WITH CHECK (true);
