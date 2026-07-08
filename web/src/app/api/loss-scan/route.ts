import { NextRequest, NextResponse } from 'next/server';
import { resolveProductByBarcode, normalizeBarcode } from '@/lib/barcode';
import { fetchBarcodeMap, incrementLossQty } from '@/lib/loss-scan';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      lossDate: string;
      storeName: string;
      barcode: string;
      productName?: string;
      delta?: number;
    };

    const { lossDate, storeName, barcode, delta = 1 } = body;
    if (!lossDate || !storeName || !barcode) {
      return NextResponse.json({ success: false, message: 'lossDate, storeName, barcode が必要です' }, { status: 400 });
    }

    let productName = body.productName;
    if (!productName) {
      const map = await fetchBarcodeMap();
      productName = resolveProductByBarcode(barcode, map) || undefined;
    }
    if (!productName) {
      return NextResponse.json({
        success: false,
        message: `未登録バーコード: ${normalizeBarcode(barcode)}`,
        barcode: normalizeBarcode(barcode),
      }, { status: 404 });
    }

    const { lossQty } = await incrementLossQty(lossDate, storeName, productName, delta);

    return NextResponse.json({
      success: true,
      productName,
      barcode: normalizeBarcode(barcode),
      lossQty,
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
