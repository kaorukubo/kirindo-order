import { createAdminClient } from '@/lib/supabase/admin';
import { useLocalDevMode } from '@/lib/env';
import { DAY_ORDER, DEFAULT_DAY_COEF, type Coefficients } from '@/lib/coefficients';
import { dayName, eachDayInRange } from '@/lib/dates';
import { getHolidaySet } from '@/lib/holidays';

export type HalfDayPeriod = 'am' | 'pm';

export interface DailySalesRow {
  date: string;
  fullDayTotal: number;
  amTotal: number;
  pmTotal: number;
  hasHalfDay: boolean;
}

export interface DayIndexResult {
  day: Record<string, number>;
  holiday: number;
  baseDate: string;
  baseDayName: string;
  baseAvg: number;
  sampleCounts: Record<string, number>;
  holidaySampleCount: number;
}

export interface CoefficientAnalysisConfig {
  baseDate: string;
  periodFrom: string;
  periodTo: string;
}

const ANALYSIS_KEY = 'coefficient_analysis';

export async function getAnalysisConfig(): Promise<CoefficientAnalysisConfig> {
  const today = new Date().toISOString().slice(0, 10);
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 56);
  const defaults: CoefficientAnalysisConfig = {
    baseDate: today,
    periodFrom: defaultFrom.toISOString().slice(0, 10),
    periodTo: today,
  };
  if (useLocalDevMode()) return defaults;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from('app_settings').select('value').eq('key', ANALYSIS_KEY).maybeSingle();
    if (!data?.value) return defaults;
    const v = data.value as Partial<CoefficientAnalysisConfig>;
    return { ...defaults, ...v };
  } catch {
    return defaults;
  }
}

export async function saveAnalysisConfig(config: CoefficientAnalysisConfig): Promise<void> {
  if (useLocalDevMode()) return;
  const supabase = createAdminClient();
  const { error } = await supabase.from('app_settings').upsert(
    { key: ANALYSIS_KEY, value: config, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  if (error) throw error;
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** 実販売数量から曜日指数を算出（基準曜日の平均比） */
export function computeDayIndices(
  dailyTotals: Record<string, number>,
  holidays: Set<string>,
  baseDate: string,
  periodFrom: string,
  periodTo: string
): DayIndexResult {
  const byWeekday: Record<string, number[]> = Object.fromEntries(DAY_ORDER.map((d) => [d, []]));
  const holidayTotals: number[] = [];
  const sampleCounts: Record<string, number> = Object.fromEntries(DAY_ORDER.map((d) => [d, 0]));

  for (const d of eachDayInRange(periodFrom, periodTo)) {
    const total = dailyTotals[d];
    if (total == null || total <= 0) continue;
    const dn = dayName(d);
    if (holidays.has(d)) {
      holidayTotals.push(total);
    } else {
      byWeekday[dn].push(total);
      sampleCounts[dn]++;
    }
  }

  const baseDayName = dayName(baseDate);
  const baseAvg = avg(byWeekday[baseDayName]) || avg(Object.values(byWeekday).flat()) || 1;

  const day: Record<string, number> = {};
  for (const dn of DAY_ORDER) {
    const a = avg(byWeekday[dn]);
    day[dn] = baseAvg > 0 && a > 0 ? Number((a / baseAvg).toFixed(2)) : DEFAULT_DAY_COEF[dn] ?? 1;
  }

  const holidayAvg = avg(holidayTotals);
  const holiday = baseAvg > 0 && holidayAvg > 0 ? Number((holidayAvg / baseAvg).toFixed(2)) : day['日'] ?? 1.3;

  return {
    day,
    holiday,
    baseDate,
    baseDayName,
    baseAvg: Number(baseAvg.toFixed(1)),
    sampleCounts,
    holidaySampleCount: holidayTotals.length,
  };
}

export function indicesToCoefficients(indices: DayIndexResult): Coefficients['day'] {
  return { ...indices.day, 祝: indices.holiday };
}

/** 日別集計（全日 + 半日） */
export async function fetchDailySales(from: string, to: string): Promise<DailySalesRow[]> {
  if (useLocalDevMode()) {
    return eachDayInRange(from, to).map((date) => ({
      date,
      fullDayTotal: 0,
      amTotal: 0,
      pmTotal: 0,
      hasHalfDay: false,
    }));
  }

  const supabase = createAdminClient();

  const { data: fullRows } = await supabase
    .from('sales')
    .select('sale_date, sales_qty')
    .gte('sale_date', from)
    .lte('sale_date', to);

  const { data: halfRows } = await supabase
    .from('half_day_sales')
    .select('sale_date, period, sales_qty')
    .gte('sale_date', from)
    .lte('sale_date', to);

  const fullByDate: Record<string, number> = {};
  for (const r of fullRows || []) {
    fullByDate[r.sale_date] = (fullByDate[r.sale_date] || 0) + (r.sales_qty || 0);
  }

  const amByDate: Record<string, number> = {};
  const pmByDate: Record<string, number> = {};
  for (const r of halfRows || []) {
    if (r.period === 'am') amByDate[r.sale_date] = (amByDate[r.sale_date] || 0) + (r.sales_qty || 0);
    else pmByDate[r.sale_date] = (pmByDate[r.sale_date] || 0) + (r.sales_qty || 0);
  }

  return eachDayInRange(from, to).map((date) => {
    const fullDayTotal = fullByDate[date] || 0;
    const amTotal = amByDate[date] || 0;
    const pmTotal = pmByDate[date] || 0;
    const hasHalfDay = amTotal > 0 || pmTotal > 0;
    const effectiveTotal = fullDayTotal > 0 ? fullDayTotal : amTotal + pmTotal;
    return { date, fullDayTotal: effectiveTotal, amTotal, pmTotal, hasHalfDay };
  });
}

export async function buildAnalytics(from: string, to: string, baseDate: string) {
  const holidays = await getHolidaySet(from, to);
  const dailyRows = await fetchDailySales(from, to);
  const dailyTotals = Object.fromEntries(dailyRows.map((r) => [r.date, r.fullDayTotal]));
  const indices = computeDayIndices(dailyTotals, holidays, baseDate, from, to);

  const dayDetails = dailyRows.map((row) => {
    const dn = dayName(row.date);
    const isHoliday = holidays.has(row.date);
    const index = isHoliday ? indices.holiday : indices.day[dn];
    return { ...row, dayName: dn, isHoliday, index };
  });

  return { dailyRows: dayDetails, indices, holidays: [...holidays] };
}

export async function upsertHalfDaySales(
  saleDate: string,
  period: HalfDayPeriod,
  storeId: string,
  productId: string,
  salesQty: number,
  lossQty = 0
): Promise<void> {
  if (useLocalDevMode()) return;
  const supabase = createAdminClient();
  const { error } = await supabase.from('half_day_sales').upsert(
    { sale_date: saleDate, period, store_id: storeId, product_id: productId, sales_qty: salesQty, loss_qty: lossQty },
    { onConflict: 'sale_date,period,store_id,product_id' }
  );
  if (error) throw error;
}
