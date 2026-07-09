import { createAdminClient } from '@/lib/supabase/admin';
import { useLocalDevMode } from '@/lib/env';
import { randomUUID } from 'crypto';

export type ShelfPhotoPhase = 'before' | 'after';

export interface ShelfPhotoRow {
  id: string;
  storeName: string;
  phase: ShelfPhotoPhase;
  staffName: string;
  imagePath: string;
  takenAt: string;
}

let devPhotos: ShelfPhotoRow[] = [];

export async function listShelfPhotos(storeName?: string): Promise<ShelfPhotoRow[]> {
  if (useLocalDevMode()) {
    if (!storeName) return [...devPhotos];
    return devPhotos.filter((p) => p.storeName === storeName);
  }

  const supabase = createAdminClient();
  let q = supabase
    .from('shelf_photos')
    .select('id, phase, staff_name, image_path, taken_at, stores(name)')
    .order('taken_at', { ascending: false })
    .limit(200);

  if (storeName) {
    const { data: store } = await supabase.from('stores').select('id').eq('name', storeName).maybeSingle();
    if (!store) return [];
    q = q.eq('store_id', store.id);
  }

  const { data, error } = await q;
  if (error) throw error;

  return (data || []).map((r) => ({
    id: r.id,
    storeName: (r.stores as unknown as { name: string })?.name || '',
    phase: r.phase as ShelfPhotoPhase,
    staffName: r.staff_name || '',
    imagePath: r.image_path,
    takenAt: r.taken_at,
  }));
}

export async function saveShelfPhoto(
  storeName: string,
  phase: ShelfPhotoPhase,
  staffName: string,
  imagePath: string
): Promise<ShelfPhotoRow> {
  const takenAt = new Date().toISOString();

  if (useLocalDevMode()) {
    const row: ShelfPhotoRow = {
      id: randomUUID(),
      storeName,
      phase,
      staffName,
      imagePath,
      takenAt,
    };
    devPhotos = [row, ...devPhotos].slice(0, 500);
    return row;
  }

  const supabase = createAdminClient();
  const { data: store } = await supabase.from('stores').select('id').eq('name', storeName).maybeSingle();
  if (!store) throw new Error('店舗が見つかりません');

  const { data, error } = await supabase
    .from('shelf_photos')
    .insert({
      store_id: store.id,
      phase,
      staff_name: staffName,
      image_path: imagePath,
    })
    .select('id, taken_at')
    .single();

  if (error) throw error;

  return {
    id: data.id,
    storeName,
    phase,
    staffName,
    imagePath,
    takenAt: data.taken_at,
  };
}

export async function deleteShelfPhoto(id: string): Promise<void> {
  if (useLocalDevMode()) {
    devPhotos = devPhotos.filter((p) => p.id !== id);
    return;
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from('shelf_photos').delete().eq('id', id);
  if (error) throw error;
}
