import { createClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, useLocalDevMode } from '@/lib/env';

export { isSupabaseConfigured, useLocalDevMode };

export function createAdminClient() {
  if (useLocalDevMode()) {
    throw new Error('ローカル開発モード（Supabase 未接続）');
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase 環境変数が未設定です (.env.local)');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}
