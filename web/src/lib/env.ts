export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();
  if (!url || !key) return false;
  if (url.includes('xxxxxxxx') || url.includes('xxxxx') || url.includes('[project-ref]')) return false;
  if (key.includes('...') || key.length < 40) return false;
  return true;
}

export function useLocalDevMode(): boolean {
  if (process.env.USE_LOCAL_DEV === 'true') return true;
  if (process.env.USE_LOCAL_DEV === 'false') return false;
  return !isSupabaseConfigured();
}
