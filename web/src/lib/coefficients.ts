import { createAdminClient } from '@/lib/supabase/admin';

export const DAY_ORDER = ['月', '火', '水', '木', '金', '土', '日'] as const;

export const DEFAULT_DAY_COEF: Record<string, number> = {
  月: 0.95,
  火: 0.95,
  水: 0.95,
  木: 0.95,
  金: 1.15,
  土: 1.3,
  日: 1.3,
};

export const DEFAULT_WEATHER_COEF: Record<string, number> = {
  晴れ: 1.0,
  曇り: 0.97,
  雨: 0.88,
};

export interface Coefficients {
  day: Record<string, number>;
  weather: Record<string, number>;
}

const SETTINGS_KEY = 'coefficients';

/** app_settings から係数を取得。テーブル/行が無い場合は既定値を返す（例外を投げない）。 */
export async function getCoefficients(): Promise<Coefficients> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();
    if (error || !data?.value) {
      return { day: { ...DEFAULT_DAY_COEF }, weather: { ...DEFAULT_WEATHER_COEF } };
    }
    const v = data.value as Partial<Coefficients>;
    return {
      day: { ...DEFAULT_DAY_COEF, ...(v.day || {}) },
      weather: { ...DEFAULT_WEATHER_COEF, ...(v.weather || {}) },
    };
  } catch {
    return { day: { ...DEFAULT_DAY_COEF }, weather: { ...DEFAULT_WEATHER_COEF } };
  }
}

export async function saveCoefficients(coef: Coefficients): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from('app_settings').upsert(
    { key: SETTINGS_KEY, value: coef, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  if (error) throw error;
}

/** coefficientMap[day][weather] = dayCoef * weatherCoef */
export function buildCoefficientMap(coef: Coefficients): Record<string, Record<string, number>> {
  const map: Record<string, Record<string, number>> = {};
  for (const day of Object.keys(coef.day)) {
    map[day] = {};
    for (const weather of Object.keys(coef.weather)) {
      map[day][weather] = Number((coef.day[day] * coef.weather[weather]).toFixed(4));
    }
  }
  return map;
}
