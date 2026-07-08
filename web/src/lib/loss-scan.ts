import { createAdminClient } from '@/lib/supabase/admin';
import { useLocalDevMode } from '@/lib/env';
import { normalizeBarcode } from '@/lib/barcode';

/** バーコード → 商品名 のマップ（サーバー） */
export async function fetchBarcodeMap(): Promise<Record<string, string>> {
  if (useLocalDevMode()) {
    return {};
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('product_label_info')
    .select('barcode, products(name)')
    .not('barcode', 'is', null)
    .neq('barcode', '');

  if (error) throw error;

  const map: Record<string, string> = {};
  for (const row of data || []) {
    const name = (row.products as unknown as { name: string } | null)?.name;
    const code = normalizeBarcode(String(row.barcode || ''));
    if (name && code) map[code] = name;
  }
  return map;
}

/** ロス数量を加算して Supabase に保存 */
export async function incrementLossQty(
  lossDate: string,
  storeName: string,
  productName: string,
  delta = 1
): Promise<{ lossQty: number }> {
  if (useLocalDevMode()) {
    return { lossQty: delta };
  }

  const supabase = createAdminClient();
  const { data: store } = await supabase.from('stores').select('id').eq('name', storeName).maybeSingle();
  const { data: product } = await supabase.from('products').select('id').eq('name', productName).maybeSingle();
  if (!store || !product) throw new Error('店舗または商品が見つかりません');

  const { data: existing } = await supabase
    .from('sales')
    .select('sales_qty, loss_qty')
    .eq('sale_date', lossDate)
    .eq('store_id', store.id)
    .eq('product_id', product.id)
    .maybeSingle();

  const lossQty = (existing?.loss_qty || 0) + delta;
  const salesQty = existing?.sales_qty || 0;

  const { error } = await supabase.from('sales').upsert(
    {
      sale_date: lossDate,
      store_id: store.id,
      product_id: product.id,
      sales_qty: salesQty,
      loss_qty: lossQty,
    },
    { onConflict: 'sale_date,store_id,product_id' }
  );
  if (error) throw error;
  return { lossQty };
}
