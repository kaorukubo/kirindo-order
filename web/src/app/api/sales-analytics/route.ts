import { NextRequest, NextResponse } from 'next/server';
import {
  buildAnalytics,
  getAnalysisConfig,
  saveAnalysisConfig,
  indicesToCoefficients,
  type CoefficientAnalysisConfig,
} from '@/lib/sales-analytics';
import { getCoefficients, saveCoefficients } from '@/lib/coefficients';
import { getHolidaysInRange, holidayMap } from '@/lib/holidays';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const config = await getAnalysisConfig();
    const from = sp.get('from') || config.periodFrom;
    const to = sp.get('to') || config.periodTo;
    const baseDate = sp.get('baseDate') || config.baseDate;

    const analytics = await buildAnalytics(from, to, baseDate);
    const holidays = await getHolidaysInRange(from, to);

    return NextResponse.json({
      success: true,
      config: { ...config, periodFrom: from, periodTo: to, baseDate },
      ...analytics,
      holidayMap: holidayMap(holidays),
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      action?: 'saveConfig' | 'applyCoefficients';
      config?: Partial<CoefficientAnalysisConfig>;
    };

    if (body.action === 'saveConfig' && body.config) {
      const current = await getAnalysisConfig();
      const next = { ...current, ...body.config };
      await saveAnalysisConfig(next);
      return NextResponse.json({ success: true, message: '分析設定を保存しました', config: next });
    }

    if (body.action === 'applyCoefficients') {
      const config = await getAnalysisConfig();
      const merged = { ...config, ...(body.config || {}) };
      const analytics = await buildAnalytics(merged.periodFrom, merged.periodTo, merged.baseDate);
      const dayCoef = indicesToCoefficients(analytics.indices);
      const current = await getCoefficients();
      await saveCoefficients({ ...current, day: { ...current.day, ...dayCoef } });
      await saveAnalysisConfig(merged);
      return NextResponse.json({
        success: true,
        message: '実績ベースの曜日指数を係数に反映しました',
        day: dayCoef,
        indices: analytics.indices,
      });
    }

    return NextResponse.json({ success: false, message: '不明な action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ success: false, message: (e as Error).message }, { status: 500 });
  }
}
