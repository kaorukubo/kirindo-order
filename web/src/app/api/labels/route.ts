import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getWeekStart, addDays } from '@/lib/dates';
import { useLocalDevMode } from '@/lib/env';

function mapLabels(
  labelRows: { store_id: string; product_id: string; label_count: number; period_from: string; period_to: string }[],
  storeNameById: Record<string, string>,
  productNameById: Record<string, string>,
  periodFrom: string,
  periodTo: string
) {
  return labelRows.map((r) => ({
    storeName: storeNameById[r.store_id] || '',
    productName: productNameById[r.product_id] || '',
    count: r.label_count,
    periodFrom: r.period_from || periodFrom,
    periodTo: r.period_to || periodTo,
  }));
}

export async function GET(req: NextRequest) {
  try {
    const weekStartStr = req.nextUrl.searchParams.get('weekStart') || getWeekStart();
    if (useLocalDevMode()) {
      return NextResponse.json({ success: true, weekStart: weekStartStr, labels: [], periodFrom: '', periodTo: '' });
    }
    const supabase = createAdminClient();
    const { data: rows } = await supabase
      .from('weekly_labels')
      .select('store_id, product_id, label_count, period_from, period_to')
      .eq('week_start', weekStartStr);

    const { data: stores } = await supabase.from('stores').select('id, name');
    const { data: products } = await supabase.from('products').select('id, name');
    const storeNameById = Object.fromEntries((stores || []).map((s) => [s.id, s.name]));
    const productNameById = Object.fromEntries((products || []).map((p) => [p.id, p.name]));

    const periodFrom = rows?.[0]?.period_from || addDays(addDays(weekStartStr, -1), -6);
    const periodTo = rows?.[0]?.period_to || addDays(weekStartStr, -1);

    return NextResponse.json({
      success: true,
      weekStart: weekStartStr,
      periodFrom,
      periodTo,
      labels: mapLabels(rows || [], storeNameById, productNameById, periodFrom, periodTo),
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const weekStartStr = body.weekStart || getWeekStart();

    const periodTo = addDays(weekStartStr, -1);
    const periodFrom = addDays(periodTo, -6);

    const supabase = createAdminClient();
    const { data: stores } = await supabase.from('stores').select('id, name');
    const { data: products } = await supabase.from('products').select('id, name');
    const storeNameById = Object.fromEntries((stores || []).map((s) => [s.id, s.name]));
    const productNameById = Object.fromEntries((products || []).map((p) => [p.id, p.name]));

    const { data: sales } = await supabase
      .from('sales')
      .select('*')
      .gte('sale_date', periodFrom)
      .lte('sale_date', periodTo);

    const totals: Record<string, number> = {};
    for (const row of sales || []) {
      const k = `${row.store_id}::${row.product_id}`;
      totals[k] = (totals[k] || 0) + (row.sales_qty || 0);
    }

    const keys = Object.keys(totals);
    if (!keys.length) {
      return NextResponse.json({
        success: false,
        message: `${periodFrom}〜${periodTo} の販売データがありません`,
      }, { status: 400 });
    }

    await supabase.from('weekly_labels').delete().eq('week_start', weekStartStr);

    const labelRows = keys.map((k) => {
      const [storeId, productId] = k.split('::');
      return {
        week_start: weekStartStr,
        store_id: storeId,
        product_id: productId,
        label_count: totals[k],
        period_from: periodFrom,
        period_to: periodTo,
      };
    });

    const { error } = await supabase.from('weekly_labels').insert(labelRows);
    if (error) throw error;

    const labels = labelRows.map((r) => ({
      storeName: storeNameById[r.store_id] || '',
      productName: productNameById[r.product_id] || '',
      count: r.label_count,
      periodFrom,
      periodTo,
    }));

    return NextResponse.json({
      success: true,
      message: `${labelRows.length}件のラベルを発行しました`,
      weekStart: weekStartStr,
      periodFrom,
      periodTo,
      labels,
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
