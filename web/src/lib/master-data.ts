import realMaster from '@/data/real-master.json';
import { createAdminClient, useLocalDevMode } from '@/lib/supabase/admin';
import { addDays, getWeekStart } from '@/lib/dates';
import { buildCoefficientMap, getCoefficients } from '@/lib/coefficients';
import { mergeHatakoFlags } from '@/lib/hatako-order';
import { fetchMasterFromLocalJson } from '@/lib/local-master';

export async function seedMasterData() {
  if (useLocalDevMode()) {
    return {
      success: true,
      message: 'ローカル開発モード: real-master.json を使用中（Supabase 不要）',
      skipped: true,
      localDev: true,
    };
  }
  const supabase = createAdminClient();

  const { count: storeCount } = await supabase.from('stores').select('*', { count: 'exact', head: true });
  if (storeCount && storeCount > 0) {
    return { success: true, message: 'マスタは既に投入済みです', skipped: true };
  }

  const stores = realMaster.STORES.map((s, i) => ({
    name: s.name,
    code: s.code,
    short_name: s.short,
    sort_order: i,
  }));
  const { data: insertedStores, error: storeErr } = await supabase.from('stores').insert(stores).select();
  if (storeErr) throw storeErr;

  const storeByName = Object.fromEntries((insertedStores || []).map((s) => [s.name, s.id]));

  const products = realMaster.productRows.map(([name, order_unit]) => ({ name, order_unit }));
  const { data: insertedProducts, error: prodErr } = await supabase.from('products').insert(products).select();
  if (prodErr) throw prodErr;

  const productByName = Object.fromEntries((insertedProducts || []).map((p) => [p.name, p.id]));

  const storeProducts = realMaster.storeProducts.map(([storeName, productName, baseDisplay]) => ({
    store_id: storeByName[storeName],
    product_id: productByName[productName],
    base_display: baseDisplay,
  }));
  const { error: spErr } = await supabase.from('store_products').insert(storeProducts);
  if (spErr) throw spErr;

  return {
    success: true,
    message: `${products.length}品 × ${stores.length}店のマスタを投入しました`,
    stores: stores.length,
    products: products.length,
  };
}

export async function buildSalesRatio(days = 7): Promise<Record<string, Record<string, number>>> {
  const supabase = createAdminClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const { data: stores } = await supabase.from('stores').select('id, name');
  const { data: products } = await supabase.from('products').select('id, name');
  const storeNameById = Object.fromEntries((stores || []).map((s) => [s.id, s.name]));
  const productNameById = Object.fromEntries((products || []).map((p) => [p.id, p.name]));

  const { data: sales } = await supabase
    .from('sales')
    .select('sale_date, store_id, product_id, sales_qty')
    .gte('sale_date', cutoffStr);

  const totals: Record<string, Record<string, number>> = {};
  for (const row of sales || []) {
    const store = storeNameById[row.store_id];
    const product = productNameById[row.product_id];
    if (!store || !product) continue;
    if (!totals[product]) totals[product] = {};
    totals[product][store] = (totals[product][store] || 0) + (row.sales_qty || 0);
  }

  const ratio: Record<string, Record<string, number>> = {};
  for (const product of Object.keys(totals)) {
    const sum = Object.values(totals[product]).reduce((a, b) => a + b, 0);
    if (sum <= 0) continue;
    ratio[product] = {};
    for (const store of Object.keys(totals[product])) {
      ratio[product][store] = totals[product][store] / sum;
    }
  }
  return ratio;
}

export async function fetchMasterData() {
  if (useLocalDevMode()) {
    return fetchMasterFromLocalJson();
  }
  const supabase = createAdminClient();

  const { data: stores } = await supabase.from('stores').select('*').order('sort_order');
  const { data: products } = await supabase.from('products').select('*').order('name');
  const { data: storeProducts } = await supabase.from('store_products').select('*, stores(name), products(name, order_unit)');
  const { data: labels } = await supabase
    .from('weekly_labels')
    .select('*, stores(name), products(name)')
    .order('issued_at', { ascending: false })
    .limit(500);

  if (!stores?.length || !products?.length) {
    throw new Error('マスタ未投入。POST /api/setup を実行してください');
  }

  const storeOrder = stores.map((s) => s.name);
  const storeShortNames = Object.fromEntries(stores.map((s) => [s.name, s.short_name]));
  const storeProductMap: Record<string, Record<string, number>> = {};
  const storeProductsMap: Record<string, { name: string; orderUnit: number; baseDisplay: number }[]> = {};

  for (const s of stores) {
    storeProductsMap[s.name] = [];
  }

  for (const sp of storeProducts || []) {
    const storeName = (sp.stores as { name: string })?.name;
    const productName = (sp.products as { name: string; order_unit: number })?.name;
    const orderUnit = (sp.products as { order_unit: number })?.order_unit ?? 1;
    if (!storeName || !productName) continue;
    if (!storeProductMap[productName]) storeProductMap[productName] = {};
    storeProductMap[productName][storeName] = sp.base_display;
    storeProductsMap[storeName].push({ name: productName, orderUnit, baseDisplay: sp.base_display });
  }

  const coef = await getCoefficients();
  const coefficientMap = buildCoefficientMap(coef);
  const weatherOptions = Object.keys(coef.weather);

  const salesRatio = await buildSalesRatio(7);
  const today = new Date().toISOString().slice(0, 10);

  const weeklyLabels = (labels || []).map((l) => ({
    storeName: (l.stores as { name: string })?.name || '',
    productName: (l.products as { name: string })?.name || '',
    count: l.label_count,
  }));

  const dbHatakoFlags = Object.fromEntries(
    (products || []).map((p) => [
      p.name,
      (p as { hatako_order_sheet?: boolean }).hatako_order_sheet !== false,
    ])
  );
  const productNames = (products || []).map((p) => p.name);
  const hatakoOrderSheet = mergeHatakoFlags(productNames, dbHatakoFlags);

  return {
    success: true,
    products: (products || []).map((p) => ({
      name: p.name,
      orderUnit: p.order_unit,
      hatakoOrderSheet: hatakoOrderSheet[p.name] !== false,
    })),
    storeOrder,
    storeShortNames,
    storeProducts: storeProductsMap,
    storeProductMap,
    hatakoOrderSheet,
    coefficientMap,
    weatherOptions,
    weatherCoefficients: coef.weather,
    dayCoefficients: coef.day,
    salesRatio,
    weekStart: getWeekStart(),
    weeklyLabels,
    deliveryLeadDays: 2,
    salesDateDefault: addDays(today, -1),
    lossDateDefault: addDays(today, 1),
  };
}
