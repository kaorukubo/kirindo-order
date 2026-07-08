'use client';

import type { MasterData } from '@/types';
import { dayName, getDeliveryDate, shortDate } from '@/lib/dates';

export interface DateControlProps {
  master: MasterData;
  orderDate: string;
  salesDate: string;
  lossDate: string;
  weather: string;
  holidayDates?: Set<string>;
  onOrderDateChange: (v: string) => void;
  onSalesDateChange: (v: string) => void;
  onLossDateChange: (v: string) => void;
  onWeatherChange: (v: string) => void;
}

export default function DateControlBar({
  master,
  orderDate,
  salesDate,
  lossDate,
  weather,
  holidayDates,
  onOrderDateChange,
  onSalesDateChange,
  onLossDateChange,
  onWeatherChange,
}: DateControlProps) {
  const deliveryDate = getDeliveryDate(orderDate);
  const isHoliday = holidayDates?.has(deliveryDate);
  const deliveryDay = isHoliday ? '祝' : dayName(deliveryDate);
  const dayCoef = master.dayCoefficients[deliveryDay] ?? master.dayCoefficients[dayName(deliveryDate)] ?? 1;
  const weatherCoef = master.weatherCoefficients[weather] ?? 1;
  const effCoef = master.coefficientMap[deliveryDay]?.[weather] ?? dayCoef * weatherCoef;

  return (
    <div className="date-bar date-bar--input">
      <label className="date-bar-field">
        <span>発注日</span>
        <input type="date" value={orderDate} onChange={(e) => onOrderDateChange(e.target.value)} />
      </label>
      <div className="date-bar-field date-bar-field--delivery">
        <span>納品日</span>
        <div className="date-bar-delivery">
          {shortDate(deliveryDate)} <em>({deliveryDay}{isHoliday ? '' : ''})</em>
        </div>
      </div>
      <label className="date-bar-field">
        <span>天候</span>
        <select value={weather} onChange={(e) => onWeatherChange(e.target.value)}>
          {master.weatherOptions.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      </label>
      <label className="date-bar-field date-bar-field--sales">
        <span>販売実績</span>
        <input type="date" value={salesDate} onChange={(e) => onSalesDateChange(e.target.value)} />
      </label>
      <label className="date-bar-field date-bar-field--loss">
        <span>ロス確認日</span>
        <input type="date" value={lossDate} onChange={(e) => onLossDateChange(e.target.value)} />
      </label>
      <div className="date-bar-field date-bar-field--coef">
        <span>指数</span>
        <div className="date-bar-coef">
          <span>曜<b>×{dayCoef}</b></span>
          <span>天<b>×{weatherCoef}</b></span>
          <span className="coef-eff">実<b>×{effCoef.toFixed(2)}</b></span>
        </div>
      </div>
    </div>
  );
}
