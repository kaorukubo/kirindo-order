import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { seedMasterData } from '@/lib/master-data';

export async function POST() {
  try {
    const result = await seedMasterData();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { count } = await supabase.from('stores').select('*', { count: 'exact', head: true });
    return NextResponse.json({ initialized: (count || 0) > 0, storeCount: count || 0 });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
