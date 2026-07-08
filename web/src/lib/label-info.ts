import { createAdminClient } from '@/lib/supabase/admin';
import { useLocalDevMode } from '@/lib/env';
import {
  defaultLabelInfo,
  mergeVisibility,
  type LabelFieldVisibility,
  type ProductLabelInfo,
} from '@/lib/label-types';

const LOCAL_KEY = 'kirindo-label-info-v1';

type StoredMap = Record<string, Omit<ProductLabelInfo, 'productName'>>;

function readLocal(): StoredMap {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') as StoredMap;
  } catch {
    return {};
  }
}

function writeLocal(map: StoredMap) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
}

function rowToInfo(productName: string, row: Record<string, unknown> | null): ProductLabelInfo {
  const base = defaultLabelInfo(productName);
  if (!row) return base;
  return {
    productName,
    unitPrice: row.unit_price != null ? Number(row.unit_price) : null,
    barcode: String(row.barcode || ''),
    seller: String(row.seller || base.seller),
    processor: String(row.processor || ''),
    origin: String(row.origin || ''),
    netWeight: String(row.net_weight || ''),
    storageMethod: String(row.storage_method || base.storageMethod),
    ingredients: String(row.ingredients || ''),
    visibility: mergeVisibility(row.field_visibility as Partial<LabelFieldVisibility>),
  };
}

export async function fetchAllLabelInfo(productNames: string[]): Promise<Record<string, ProductLabelInfo>> {
  const out: Record<string, ProductLabelInfo> = {};
  for (const name of productNames) out[name] = defaultLabelInfo(name);

  if (useLocalDevMode()) {
    const local = readLocal();
    for (const name of productNames) {
      if (local[name]) out[name] = { ...out[name], ...local[name], productName: name };
    }
    return out;
  }

  const supabase = createAdminClient();
  const { data: products } = await supabase.from('products').select('id, name').in('name', productNames);
  const idByName = Object.fromEntries((products || []).map((p) => [p.name, p.id]));
  const ids = Object.values(idByName);
  if (!ids.length) return out;

  const { data: rows } = await supabase.from('product_label_info').select('*').in('product_id', ids);
  const rowByProductId = Object.fromEntries((rows || []).map((r) => [r.product_id, r]));

  for (const name of productNames) {
    const pid = idByName[name];
    if (pid && rowByProductId[pid]) out[name] = rowToInfo(name, rowByProductId[pid]);
  }
  return out;
}

export async function saveLabelInfo(info: ProductLabelInfo): Promise<void> {
  if (useLocalDevMode()) {
    const local = readLocal();
    const { productName, ...rest } = info;
    local[productName] = rest;
    writeLocal(local);
    return;
  }

  const supabase = createAdminClient();
  const { data: product } = await supabase.from('products').select('id').eq('name', info.productName).maybeSingle();
  if (!product) throw new Error('商品が見つかりません');

  const { error } = await supabase.from('product_label_info').upsert(
    {
      product_id: product.id,
      unit_price: info.unitPrice,
      barcode: info.barcode,
      seller: info.seller,
      processor: info.processor,
      origin: info.origin,
      net_weight: info.netWeight,
      storage_method: info.storageMethod,
      ingredients: info.ingredients,
      field_visibility: info.visibility,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'product_id' }
  );
  if (error) throw error;
}
