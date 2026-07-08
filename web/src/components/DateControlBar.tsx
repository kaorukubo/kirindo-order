'use client';

import type { MasterData } from '@/types';
import { dayName, getDeliveryDate, shortDate } from '@/lib/dates';

export interface DateControlProps {
  master: MasterData;
  orderDate: string;
  salesDate: string;
  lossDate: string;
  weather: string;
  weatherLine?: string;
  onOrderDateChange: (v: string) => void;
  onSalesDateChange: (v: string) => void;
  onLossDateChange: (v: string) => void;
  onWeatherChange: (v: string) => void;
  variant?: 'sidebar' | 'input';
}

export default function DateControlBar({
  master,
  orderDate,
  salesDate,
  lossDate,
  weather,
  weatherLine,
  onOrderDateChange,
  onSalesDateChange,
  onLossDateChange,
  onWeatherChange,
  variant = 'sidebar',
}: DateControlProps) {
  const deliveryDate = getDeliveryDate(orderDate);
  const deliveryDay = dayName(deliveryDate);
  const dayCoef = master.dayCoefficients[deliveryDay] ?? 1;
  const weatherCoef = master.weatherCoefficients[weather] ?? 1;
  const effCoef = master.coefficientMap[deliveryDay]?.[weather] ?? dayCoef * weatherCoef;
  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });

  if (variant === 'input') {
    return (
      <div className="date-bar date-bar--input">
        <div className="date-bar-row">
          <span className="date-bar-today">今日 {today}</span>
          <label className="date-bar-field">
            <span>発注日</span>
            <input type="date" value={orderDate} onChange={(e) => onOrderDateChange(e.target.value)} />
          </label>
          <label className="date-bar-field date-bar-field--delivery">
            <span>納品日</span>
            <div className="date-bar-delivery">
              {shortDate(deliveryDate)} <em>({deliveryDay})</em>
            </div>
          </label>
          <label className="date-bar-field">
            <span>予想天候</span>
            <select value={weather} onChange={(e) => onWeatherChange(e.target.value)}>
              {master.weatherOptions.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="date-bar-row date-bar-row--sub">
          <div className="coef-readout coef-readout--light">
            <span>曜日 <b>×{dayCoef}</b></span>
            <span>天候 <b>×{weatherCoef}</b></span>
            <span className="coef-eff">実効 <b>×{effCoef.toFixed(2)}</b></span>
          </div>
          <label className="date-bar-field date-bar-field--sales">
            <span>販売実績日</span>
            <input type="date" value={salesDate} onChange={(e) => onSalesDateChange(e.target.value)} />
          </label>
          <label className="date-bar-field date-bar-field--loss">
            <span>ロス確認日</span>
            <input type="date" value={lossDate} onChange={(e) => onLossDateChange(e.target.value)} />
          </label>
          {weatherLine && <p className="date-bar-weather-line">{weatherLine}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="date-bar date-bar--sidebar">
      <p className="date-sidebar-today">{today}</p>
      <label className="date-sidebar-field">
        <span>発注日</span>
        <input type="date" value={orderDate} onChange={(e) => onOrderDateChange(e.target.value)} className="date-sidebar-input-lg" />
      </label>
      <div className="date-sidebar-field date-sidebar-field--delivery">
        <span>納品日</span>
        <p className="date-sidebar-delivery-lg">
          {shortDate(deliveryDate)}
          <small>({deliveryDay})</small>
        </p>
      </div>
      <label className="date-sidebar-field">
        <span>天候</span>
        <select value={weather} onChange={(e) => onWeatherChange(e.target.value)}>
          {master.weatherOptions.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      </label>
      <div className="coef-readout">
        <span>曜日 <b>×{dayCoef}</b></span>
        <span>天候 <b>×{weatherCoef}</b></span>
        <span className="coef-eff">実効 <b>×{effCoef.toFixed(2)}</b></span>
      </div>
      <label className="side-field side-field--sales">
        <span>販売実績日</span>
        <input type="date" value={salesDate} onChange={(e) => onSalesDateChange(e.target.value)} />
      </label>
      <label className="side-field side-field--loss">
        <span>ロス確認日</span>
        <input type="date" value={lossDate} onChange={(e) => onLossDateChange(e.target.value)} />
      </label>
    </div>
  );
}
