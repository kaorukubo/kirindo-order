import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

type Action =
  | 'addProduct'
  | 'updateProduct'
  | 'deleteProduct'
  | 'addStore'
  | 'updateStore'
  | 'deleteStore'
  | 'setStoreProduct'
  | 'removeStoreProduct'
  | 'setHatakoOrderSheet';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as Action;
    const supabase = createAdminClient();

    const idOfProduct = async (name: string) => {
      const { data } = await supabase.from('products').select('id').eq('name', name).maybeSingle();
      return data?.id as string | undefined;
    };
    const idOfStore = async (name: string) => {
      const { data } = await supabase.from('stores').select('id').eq('name', name).maybeSingle();
      return data?.id as string | undefined;
    };

    switch (action) {
      case 'addProduct': {
        const name = String(body.name || '').trim();
        const orderUnit = Math.max(1, Number(body.orderUnit) || 1);
        if (!name) throw new Error('商品名が必要です');
        const { error } = await supabase.from('products').insert({ name, order_unit: orderUnit });
        if (error) throw error;
        return NextResponse.json({ success: true, message: `商品「${name}」を追加しました` });
      }
      case 'updateProduct': {
        const name = String(body.name || '').trim();
        const orderUnit = Math.max(1, Number(body.orderUnit) || 1);
        const { error } = await supabase.from('products').update({ order_unit: orderUnit }).eq('name', name);
        if (error) throw error;
        return NextResponse.json({ success: true, message: `商品「${name}」を更新しました` });
      }
      case 'deleteProduct': {
        const name = String(body.name || '').trim();
        const { error } = await supabase.from('products').delete().eq('name', name);
        if (error) throw error;
        return NextResponse.json({ success: true, message: `商品「${name}」を削除しました` });
      }
      case 'addStore': {
        const name = String(body.name || '').trim();
        const code = String(body.code || name).trim();
        const short = String(body.short || name.slice(0, 3)).trim();
        if (!name) throw new Error('店舗名が必要です');
        const { count } = await supabase.from('stores').select('*', { count: 'exact', head: true });
        const { error } = await supabase
          .from('stores')
          .insert({ name, code, short_name: short, sort_order: count || 0 });
        if (error) throw error;
        return NextResponse.json({ success: true, message: `店舗「${name}」を追加しました` });
      }
      case 'updateStore': {
        const name = String(body.name || '').trim();
        const patch: Record<string, unknown> = {};
        if (body.short != null) patch.short_name = String(body.short).trim();
        if (body.code != null) patch.code = String(body.code).trim();
        const { error } = await supabase.from('stores').update(patch).eq('name', name);
        if (error) throw error;
        return NextResponse.json({ success: true, message: `店舗「${name}」を更新しました` });
      }
      case 'deleteStore': {
        const name = String(body.name || '').trim();
        const { error } = await supabase.from('stores').delete().eq('name', name);
        if (error) throw error;
        return NextResponse.json({ success: true, message: `店舗「${name}」を削除しました` });
      }
      case 'setStoreProduct': {
        const storeId = await idOfStore(String(body.storeName || ''));
        const productId = await idOfProduct(String(body.productName || ''));
        if (!storeId || !productId) throw new Error('店舗または商品が見つかりません');
        const baseDisplay = Math.max(0, Number(body.baseDisplay) || 0);
        const { error } = await supabase
          .from('store_products')
          .upsert({ store_id: storeId, product_id: productId, base_display: baseDisplay }, { onConflict: 'store_id,product_id' });
        if (error) throw error;
        return NextResponse.json({ success: true, message: '陳列数を更新しました' });
      }
      case 'removeStoreProduct': {
        const storeId = await idOfStore(String(body.storeName || ''));
        const productId = await idOfProduct(String(body.productName || ''));
        if (!storeId || !productId) throw new Error('店舗または商品が見つかりません');
        const { error } = await supabase
          .from('store_products')
          .delete()
          .eq('store_id', storeId)
          .eq('product_id', productId);
        if (error) throw error;
        return NextResponse.json({ success: true, message: '取扱から外しました' });
      }
      case 'setHatakoOrderSheet': {
        const name = String(body.productName || '').trim();
        const enabled = body.enabled !== false;
        if (!name) throw new Error('商品名が必要です');
        const { error } = await supabase
          .from('products')
          .update({ hatako_order_sheet: enabled })
          .eq('name', name);
        if (error) throw error;
        return NextResponse.json({
          success: true,
          message: enabled ? `「${name}」を畑光発注書に掲載します` : `「${name}」を畑光発注書から除外しました`,
        });
      }
      default:
        return NextResponse.json({ success: false, message: '不明な操作です' }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
