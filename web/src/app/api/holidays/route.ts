import { NextRequest, NextResponse } from 'next/server';
import { getHolidaysInRange, holidayMap, importHolidaysYears } from '@/lib/holidays';

export async function GET(req: NextRequest) {
  try {
    const from = req.nextUrl.searchParams.get('from');
    const to = req.nextUrl.searchParams.get('to');
    if (!from || !to) {
      return NextResponse.json({ success: false, message: 'from, to が必要です' }, { status: 400 });
    }
    const rows = await getHolidaysInRange(from, to);
    return NextResponse.json({ success: true, holidays: rows, map: holidayMap(rows) });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { years?: number[] };
    const now = new Date().getFullYear();
    const years = body.years?.length ? body.years : [now - 1, now, now + 1];
    const result = await importHolidaysYears(years);
    return NextResponse.json({
      success: true,
      message: `${result.imported}件の祝日を取込しました（${result.years.join(', ')}年）`,
      ...result,
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
