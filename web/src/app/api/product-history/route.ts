import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const product = req.nextUrl.searchParams.get('product');
    const days = Math.min(120, Math.max(7, Number(req.nextUrl.searchParams.get('days')) || 42));
    if (!product) {
      return NextResponse.json({ success: false, message: 'product が必要です' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: prod } = await supabase.from('products').select('id, name, order_unit').eq('name', product).maybeSingle();
    if (!prod) {
      return NextResponse.json({ success: false, message: '商品が見つかりません' }, { status: 404 });
    }

    const { data: stores } = await supabase.from('stores').select('id, name, short_name').order('sort_order');
    const storeNameById = Object.fromEntries((stores || []).map((s) => [s.id, s.name]));

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const { data: rows } = await supabase
      .from('sales')
      .select('sale_date, store_id, sales_qty, loss_qty')
      .eq('product_id', prod.id)
      .gte('sale_date', cutoffStr)
      .order('sale_date', { ascending: false });

    // date -> store -> {sales, loss}
    const byDate: Record<string, Record<string, { sales: number; loss: number }>> = {};
    const totalByStore: Record<string, number> = {};
    for (const r of rows || []) {
      const store = storeNameById[r.store_id];
      if (!store) continue;
      if (!byDate[r.sale_date]) byDate[r.sale_date] = {};
      byDate[r.sale_date][store] = {
        sales: (byDate[r.sale_date][store]?.sales || 0) + (r.sales_qty || 0),
        loss: (byDate[r.sale_date][store]?.loss || 0) + (r.loss_qty || 0),
      };
      totalByStore[store] = (totalByStore[store] || 0) + (r.sales_qty || 0);
    }

    const dates = Object.keys(byDate).sort((a, b) => (a < b ? 1 : -1));

    return NextResponse.json({
      success: true,
      product: prod.name,
      orderUnit: prod.order_unit,
      stores: (stores || []).map((s) => ({ name: s.name, short: s.short_name })),
      dates,
      byDate,
      totalByStore,
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
