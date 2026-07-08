import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { useLocalDevMode } from '@/lib/env';

export async function GET(req: NextRequest) {
  try {
    const from = req.nextUrl.searchParams.get('from');
    const to = req.nextUrl.searchParams.get('to');
    if (!from || !to) {
      return NextResponse.json({ success: false, message: 'from, to が必要です' }, { status: 400 });
    }
    if (useLocalDevMode()) {
      return NextResponse.json({ success: true, rows: [] });
    }
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('half_day_sales')
      .select('sale_date, period, sales_qty, loss_qty, stores(name), products(name)')
      .gte('sale_date', from)
      .lte('sale_date', to)
      .order('sale_date', { ascending: false });
    if (error) throw error;
    const rows = (data || []).map((r) => {
      const stores = r.stores as unknown as { name: string } | null;
      const products = r.products as unknown as { name: string } | null;
      return {
        date: r.sale_date,
        period: r.period,
        salesQty: r.sales_qty,
        lossQty: r.loss_qty,
        store: stores?.name,
        product: products?.name,
      };
    });
    return NextResponse.json({ success: true, rows });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      saleDate: string;
      period: 'am' | 'pm';
      storeName: string;
      productName: string;
      salesQty: number;
      lossQty?: number;
    };
    if (useLocalDevMode()) {
      return NextResponse.json({ success: true, message: 'ローカル開発モード: 半日実績は保存されません' });
    }
    const supabase = createAdminClient();
    const { data: store } = await supabase.from('stores').select('id').eq('name', body.storeName).maybeSingle();
    const { data: product } = await supabase.from('products').select('id').eq('name', body.productName).maybeSingle();
    if (!store || !product) {
      return NextResponse.json({ success: false, message: '店舗または商品が見つかりません' }, { status: 404 });
    }
    const { error } = await supabase.from('half_day_sales').upsert(
      {
        sale_date: body.saleDate,
        period: body.period,
        store_id: store.id,
        product_id: product.id,
        sales_qty: body.salesQty,
        loss_qty: body.lossQty ?? 0,
      },
      { onConflict: 'sale_date,period,store_id,product_id' }
    );
    if (error) throw error;
    return NextResponse.json({ success: true, message: '半日実績を保存しました' });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
