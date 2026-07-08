import { NextResponse } from 'next/server';
import { isSupabaseConfigured, useLocalDevMode } from '@/lib/supabase/admin';

export async function GET() {
  if (useLocalDevMode()) {
    return NextResponse.json({
      ok: true,
      mode: 'local',
      message: 'ローカル開発モード（real-master.json）。Supabase 接続時は .env.local に本番キーを設定',
      supabaseConfigured: isSupabaseConfigured(),
    });
  }

  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();
    const { count } = await supabase.from('stores').select('*', { count: 'exact', head: true });
    return NextResponse.json({
      ok: true,
      mode: 'supabase',
      storeCount: count || 0,
      masterSeeded: (count || 0) > 0,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      message: (e as Error).message,
    });
  }
}
