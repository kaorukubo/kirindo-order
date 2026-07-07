import { DELIVERY_LEAD_DAYS, DAY_NAMES, type DayName } from '@/types';

export function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return fmt(d);
}

export function dayName(dateStr: string): DayName {
  return DAY_NAMES[new Date(dateStr + 'T00:00:00').getDay()];
}

export function shortDate(dateStr: string): string {
  const p = dateStr.split('-');
  return `${Number(p[1])}/${Number(p[2])}`;
}

export function getDeliveryDate(orderDate: string): string {
  return addDays(orderDate, DELIVERY_LEAD_DAYS);
}

export function getWeekStart(date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return fmt(d);
}

export function parseCsvDate(v: string): string {
  const s = String(v || '').trim();
  if (/^\d{8}$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return s;
}
