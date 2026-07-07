import { NextRequest, NextResponse } from 'next/server';
import { addDays, dayName, getDeliveryDate } from '@/lib/dates';

const KOBE_LAT = 34.6901;
const KOBE_LON = 135.1956;

function wmoToWeather(code: number): string {
  if (code === 0 || code === 1) return '晴れ';
  if (code === 2 || code === 3 || code === 45 || code === 48) return '曇り';
  if (code >= 51 && code <= 99) return '雨';
  return '曇り';
}

export async function GET(req: NextRequest) {
  try {
    const orderDate = req.nextUrl.searchParams.get('orderDate') || new Date().toISOString().slice(0, 10);
    const deliveryDate = getDeliveryDate(orderDate);
    const arrivalDate = addDays(orderDate, 1);

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${KOBE_LAT}&longitude=${KOBE_LON}&daily=weather_code&timezone=Asia%2FTokyo&forecast_days=16`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const data = await res.json();

    const dates: string[] = data?.daily?.time || [];
    const codes: number[] = data?.daily?.weather_code || [];
    const idx = dates.indexOf(deliveryDate);
    const code = idx >= 0 ? codes[idx] : codes[0];
    const weather = wmoToWeather(code ?? 2);

    return NextResponse.json({
      success: true,
      location: '神戸市',
      orderDate,
      arrivalDate,
      deliveryDate,
      deliveryDayName: dayName(deliveryDate),
      weather,
      weatherCode: code,
      source: 'Open-Meteo',
    });
  } catch (e) {
    const orderDate = req.nextUrl.searchParams.get('orderDate') || new Date().toISOString().slice(0, 10);
    return NextResponse.json({
      success: false,
      message: (e as Error).message,
      orderDate,
      deliveryDate: getDeliveryDate(orderDate),
      deliveryDayName: dayName(getDeliveryDate(orderDate)),
    });
  }
}
