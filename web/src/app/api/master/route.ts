import { NextResponse } from 'next/server';
import { fetchMasterData } from '@/lib/master-data';

export async function GET() {
  try {
    const data = await fetchMasterData();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
