import { NextRequest, NextResponse } from 'next/server';
import { getCoefficients, saveCoefficients, type Coefficients } from '@/lib/coefficients';

export async function GET() {
  try {
    const coef = await getCoefficients();
    return NextResponse.json({ success: true, ...coef });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<Coefficients>;
    const current = await getCoefficients();
    const next: Coefficients = {
      day: { ...current.day, ...(body.day || {}) },
      weather: { ...current.weather, ...(body.weather || {}) },
    };
    await saveCoefficients(next);
    return NextResponse.json({ success: true, message: '係数を保存しました', ...next });
  } catch (e) {
    return NextResponse.json(
      { success: false, message: `保存に失敗しました（app_settings テーブル未作成の可能性）: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
