import { NextRequest, NextResponse } from 'next/server';
import { fetchAllLabelInfo, saveLabelInfo } from '@/lib/label-info';
import type { ProductLabelInfo } from '@/lib/label-types';

export async function GET(req: NextRequest) {
  try {
    const names = req.nextUrl.searchParams.get('products')?.split(',').filter(Boolean) || [];
    if (!names.length) {
      return NextResponse.json({ success: false, message: 'products が必要です' }, { status: 400 });
    }
    const labels = await fetchAllLabelInfo(names);
    return NextResponse.json({ success: true, labels });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ProductLabelInfo;
    if (!body.productName) {
      return NextResponse.json({ success: false, message: 'productName が必要です' }, { status: 400 });
    }
    await saveLabelInfo(body);
    return NextResponse.json({ success: true, message: 'ラベル情報を保存しました' });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
