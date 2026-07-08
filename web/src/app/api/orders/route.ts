import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, useLocalDevMode } from '@/lib/supabase/admin';
import type { SaveOrderPayload } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as SaveOrderPayload;
    if (!payload.targetDate || !payload.items?.length) {
      return NextResponse.json({ success: false, message: '保存データが不正です' }, { status: 400 });
    }

    const toSave = payload.items.filter((it) => it.totalUnits > 0);

    if (useLocalDevMode()) {
      return NextResponse.json({
        success: true,
        message: `ローカル開発: ${toSave.length}件（Supabase 未保存）`,
        savedCount: toSave.length,
        localDev: true,
      });
    }

    const supabase = createAdminClient();
    const { data: stores } = await supabase.from('stores').select('id, name').order('sort_order');
    const { data: products } = await supabase.from('products').select('id, name');
    const productByName = Object.fromEntries((products || []).map((p) => [p.name, p.id]));

    const orderRows = toSave.map((item) => ({
      delivery_date: payload.targetDate,
      order_date: payload.orderDate,
      product_id: productByName[item.productName],
      total_units: item.totalUnits,
      cases: item.cases,
      remainder: item.remainder,
      alloc_store_1: item.allocations[0] || 0,
      alloc_store_2: item.allocations[1] || 0,
      alloc_store_3: item.allocations[2] || 0,
      alloc_store_4: item.allocations[3] || 0,
      loss_store_1: item.losses[0] || 0,
      loss_store_2: item.losses[1] || 0,
      loss_store_3: item.losses[2] || 0,
      loss_store_4: item.losses[3] || 0,
      weather: payload.weather,
    })).filter((r) => r.product_id);

    const { error: orderErr } = await supabase.from('order_results').insert(orderRows);
    if (orderErr) throw orderErr;

    const salesRows: { sale_date: string; store_id: string; product_id: string; sales_qty: number; loss_qty: number }[] = [];
    toSave.forEach((item) => {
      const productId = productByName[item.productName];
      if (!productId) return;
      payload.storeOrder.forEach((storeName, i) => {
        const store = stores?.find((s) => s.name === storeName);
        if (!store) return;
        salesRows.push({
          sale_date: payload.targetDate,
          store_id: store.id,
          product_id: productId,
          sales_qty: item.sales[i] || 0,
          loss_qty: item.losses[i] || 0,
        });
      });
    });

    if (salesRows.length) {
      const { error: salesErr } = await supabase.from('sales').upsert(salesRows, {
        onConflict: 'sale_date,store_id,product_id',
      });
      if (salesErr) throw salesErr;
    }

    return NextResponse.json({
      success: true,
      message: `${toSave.length}件の発注データを保存しました`,
      savedCount: toSave.length,
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
