import { NextResponse } from 'next/server';
import { fetchBarcodeMap } from '@/lib/loss-scan';

export async function GET() {
  try {
    const map = await fetchBarcodeMap();
    return NextResponse.json({ success: true, map, count: Object.keys(map).length });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
