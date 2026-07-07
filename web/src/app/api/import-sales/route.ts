import { NextRequest, NextResponse } from 'next/server';
import { parseSalesCsv, upsertSalesRows } from '@/lib/csv-import';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll('files') as File[];
    if (!files.length) {
      return NextResponse.json({ success: false, message: 'CSVファイルを選択してください' }, { status: 400 });
    }

    let allRows: ReturnType<typeof parseSalesCsv> = [];
    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer());
      allRows = allRows.concat(parseSalesCsv(buf));
    }

    const map = new Map<string, (typeof allRows)[0]>();
    for (const row of allRows) {
      const key = `${row.date}::${row.storeName}::${row.productName}`;
      const prev = map.get(key);
      if (prev) prev.salesQty += row.salesQty;
      else map.set(key, { ...row });
    }
    const merged = [...map.values()];

    const { upserted } = await upsertSalesRows(merged);

    return NextResponse.json({
      success: true,
      message: `${files.length} CSV・${upserted}行を取り込みました`,
      files: files.length,
      rows: upserted,
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
