import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, useLocalDevMode } from '@/lib/supabase/admin';
import { emptyStoreInput, fetchMasterFromLocalJson } from '@/lib/local-master';

export async function GET(req: NextRequest) {
  try {
    const salesDate = req.nextUrl.searchParams.get('salesDate');
    const lossDate = req.nextUrl.searchParams.get('lossDate');
    if (!salesDate || !lossDate) {
      return NextResponse.json({ success: false, message: 'salesDate と lossDate が必要です' }, { status: 400 });
    }

    if (useLocalDevMode()) {
      const m = fetchMasterFromLocalJson();
      const names = m.products.map((p) => String(p.name));
      const { sales, losses } = emptyStoreInput(m.storeOrder, names);
      return NextResponse.json({ success: true, salesDate, lossDate, sales, losses, localDev: true });
    }

    const supabase = createAdminClient();
    const { data: stores } = await supabase.from('stores').select('id, name');
    const { data: products } = await supabase.from('products').select('id, name');
    const storeNameById = Object.fromEntries((stores || []).map((s) => [s.id, s.name]));
    const productNameById = Object.fromEntries((products || []).map((p) => [p.id, p.name]));

    const { data: salesRows } = await supabase
      .from('sales')
      .select('*')
      .in('sale_date', [salesDate, lossDate]);

    const sales: Record<string, Record<string, number>> = {};
    const losses: Record<string, Record<string, number>> = {};

    for (const row of salesRows || []) {
      const store = storeNameById[row.store_id];
      const product = productNameById[row.product_id];
      if (!store || !product) continue;

      if (row.sale_date === salesDate) {
        if (!sales[store]) sales[store] = {};
        sales[store][product] = (sales[store][product] || 0) + (row.sales_qty || 0);
      }
      if (row.sale_date === lossDate) {
        if (!losses[store]) losses[store] = {};
        losses[store][product] = (losses[store][product] || 0) + (row.loss_qty || 0);
      }
    }

    return NextResponse.json({ success: true, salesDate, lossDate, sales, losses });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
