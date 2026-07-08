import { createAdminClient } from '@/lib/supabase/admin';
import { useLocalDevMode } from '@/lib/env';

const HOLIDAYS_JP_URL = 'https://holidays-jp.github.io/api/v1';

export interface HolidayRow {
  holiday_date: string;
  name: string;
}

/** holidays-jp.github.io から指定年の祝日を取得 */
export async function fetchHolidaysFromApi(year: number): Promise<HolidayRow[]> {
  const res = await fetch(`${HOLIDAYS_JP_URL}/${year}/date.json`, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`${year}年の祝日取得に失敗しました`);
  const data = (await res.json()) as Record<string, string>;
  return Object.entries(data).map(([holiday_date, name]) => ({ holiday_date, name }));
}

export async function importHolidaysYears(years: number[]): Promise<{ imported: number; years: number[] }> {
  const rows: HolidayRow[] = [];
  for (const y of years) {
    const yearRows = await fetchHolidaysFromApi(y);
    rows.push(...yearRows);
  }
  if (useLocalDevMode()) {
    return { imported: rows.length, years };
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from('holidays').upsert(
    rows.map((r) => ({ ...r, source: 'holidays-jp', imported_at: new Date().toISOString() })),
    { onConflict: 'holiday_date' }
  );
  if (error) throw error;
  return { imported: rows.length, years };
}

export async function getHolidaysInRange(from: string, to: string): Promise<HolidayRow[]> {
  if (useLocalDevMode()) {
    const years = new Set<number>();
    for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) years.add(y);
    const all: HolidayRow[] = [];
    for (const y of years) {
      try {
        all.push(...(await fetchHolidaysFromApi(y)));
      } catch {
        /* skip */
      }
    }
    return all.filter((h) => h.holiday_date >= from && h.holiday_date <= to);
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('holidays')
    .select('holiday_date, name')
    .gte('holiday_date', from)
    .lte('holiday_date', to)
    .order('holiday_date');
  if (error) throw error;
  return (data || []) as HolidayRow[];
}

export async function getHolidaySet(from: string, to: string): Promise<Set<string>> {
  const rows = await getHolidaysInRange(from, to);
  return new Set(rows.map((r) => r.holiday_date));
}

export function holidayMap(rows: HolidayRow[]): Record<string, string> {
  return Object.fromEntries(rows.map((r) => [r.holiday_date, r.name]));
}
