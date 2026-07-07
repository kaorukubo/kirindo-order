import iconv from 'iconv-lite';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseCsvDate } from '@/lib/dates';

export interface ParsedSalesRow {
  date: string;
  storeName: string;
  productName: string;
  salesQty: number;
}

export function parseSalesCsv(buffer: Buffer): ParsedSalesRow[] {
  let text = iconv.decode(buffer, 'Shift_JIS');
  if (!text.includes('検収日')) {
    text = buffer.toString('utf-8');
  }
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const iDate = headers.indexOf('検収日');
  const iStore = headers.indexOf('店舗名');
  const iProduct = headers.indexOf('商品名');
  const iQty = headers.indexOf('受領数量');
  if (iDate < 0 || iStore < 0 || iProduct < 0 || iQty < 0) return [];

  const map = new Map<string, number>();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = line.split(',');
    const date = parseCsvDate(cols[iDate]);
    const store = (cols[iStore] || '').trim();
    const product = (cols[iProduct] || '').trim();
    const qty = Math.round(Number(cols[iQty]) || 0);
    if (!date || !store || !product || qty <= 0) continue;
    const key = `${date}::${store}::${product}`;
    map.set(key, (map.get(key) || 0) + qty);
  }

  return [...map.entries()].map(([key, salesQty]) => {
    const [date, storeName, productName] = key.split('::');
    return { date, storeName, productName, salesQty };
  });
}

export async function upsertSalesRows(rows: ParsedSalesRow[]) {
  if (rows.length === 0) return { upserted: 0 };

  const supabase = createAdminClient();
  const { data: stores } = await supabase.from('stores').select('id, name');
  const { data: products } = await supabase.from('products').select('id, name');
  const storeByName = Object.fromEntries((stores || []).map((s) => [s.name, s.id]));
  const productByName = Object.fromEntries((products || []).map((p) => [p.name, p.id]));

  const payload = rows
    .filter((r) => storeByName[r.storeName] && productByName[r.productName])
    .map((r) => ({
      sale_date: r.date,
      store_id: storeByName[r.storeName],
      product_id: productByName[r.productName],
      sales_qty: r.salesQty,
      loss_qty: 0,
    }));

  const chunk = 500;
  let upserted = 0;
  for (let i = 0; i < payload.length; i += chunk) {
    const part = payload.slice(i, i + chunk);
    const { error } = await supabase.from('sales').upsert(part, {
      onConflict: 'sale_date,store_id,product_id',
    });
    if (error) throw error;
    upserted += part.length;
  }
  return { upserted };
}
