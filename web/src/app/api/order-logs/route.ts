import { NextRequest, NextResponse } from 'next/server';
import { getOrderLogSnapshot, listOrderLogs } from '@/lib/order-logs';

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (id) {
      const snapshot = await getOrderLogSnapshot(id);
      if (!snapshot) {
        return NextResponse.json({ success: false, message: 'ログが見つかりません' }, { status: 404 });
      }
      return NextResponse.json({ success: true, snapshot });
    }

    const logs = await listOrderLogs(100);
    return NextResponse.json({ success: true, logs });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
