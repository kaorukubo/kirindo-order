'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MasterData } from '@/types';
import { DAY_ORDER } from '@/lib/coefficients';
import {
  addDays,
  addMonths,
  dayName,
  fmt,
  getMonthEnd,
  getMonthStart,
  getWeekStart,
  monthLabel,
  shortDate,
  weekLabel,
} from '@/lib/dates';

interface Props {
  master: MasterData;
  onChanged: () => Promise<void> | void;
  onToast: (msg: string) => void;
}

interface DayDetail {
  date: string;
  fullDayTotal: number;
  amTotal: number;
  pmTotal: number;
  hasHalfDay: boolean;
  dayName: string;
  isHoliday: boolean;
  index: number;
}

interface AnalyticsData {
  config: { baseDate: string; periodFrom: string; periodTo: string };
  dailyRows: DayDetail[];
  indices: {
    day: Record<string, number>;
    holiday: number;
    baseDate: string;
    baseDayName: string;
    baseAvg: number;
    sampleCounts: Record<string, number>;
    holidaySampleCount: number;
  };
  holidayMap: Record<string, string>;
}

type ViewMode = 'week' | 'month';

export default function CalendarPanel({ master, onChanged, onToast }: Props) {
  const today = fmt(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [anchorDate, setAnchorDate] = useState(today);
  const [periodFrom, setPeriodFrom] = useState(() => addDays(today, -56));
  const [periodTo, setPeriodTo] = useState(today);
  const [baseDate, setBaseDate] = useState(today);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ from: periodFrom, to: periodTo, baseDate });
      const res = await fetch(`/api/sales-analytics?${q}`).then((r) => r.json());
      if (res.success) {
        setData(res);
        if (res.config) {
          setBaseDate(res.config.baseDate);
          setPeriodFrom(res.config.periodFrom);
          setPeriodTo(res.config.periodTo);
        }
      } else {
        onToast(res.message || '読込失敗');
      }
    } catch {
      onToast('分析データの読込に失敗しました');
    }
    setLoading(false);
  }, [periodFrom, periodTo, baseDate, onToast]);

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dayMap = useMemo(() => {
    const m: Record<string, DayDetail> = {};
    for (const d of data?.dailyRows || []) m[d.date] = d;
    return m;
  }, [data]);

  const holidayMap = data?.holidayMap || {};

  const calendarDays = useMemo(() => {
    if (viewMode === 'week') {
      const start = getWeekStart(new Date(anchorDate + 'T00:00:00'));
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const monthStart = getMonthStart(anchorDate);
    const monthEnd = getMonthEnd(anchorDate);
    const gridStart = getWeekStart(new Date(monthStart + 'T00:00:00'));
    const days: string[] = [];
    let d = gridStart;
    while (days.length < 42) {
      days.push(d);
      d = addDays(d, 1);
    }
    return days;
  }, [viewMode, anchorDate]);

  const headerLabel = useMemo(() => {
    if (viewMode === 'week') {
      const start = calendarDays[0];
      const end = calendarDays[6];
      return weekLabel(start, end);
    }
    return monthLabel(anchorDate);
  }, [viewMode, anchorDate, calendarDays]);

  const navigate = (dir: -1 | 1) => {
    if (viewMode === 'week') setAnchorDate(addDays(anchorDate, dir * 7));
    else setAnchorDate(addMonths(anchorDate, dir));
  };

  const saveConfig = async () => {
    setBusy('save');
    const res = await fetch('/api/sales-analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'saveConfig', config: { baseDate, periodFrom, periodTo } }),
    }).then((r) => r.json());
    onToast(res.success ? '✓ 設定を保存しました' : res.message);
    setBusy('');
  };

  const reloadAnalysis = async () => {
    setBusy('reload');
    await load();
    setBusy('');
  };

  const importHolidays = async () => {
    setBusy('holidays');
    const y = Number(anchorDate.slice(0, 4));
    const res = await fetch('/api/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ years: [y - 1, y, y + 1] }),
    }).then((r) => r.json());
    onToast(res.success ? `✓ ${res.message}` : res.message);
    if (res.success) await load();
    setBusy('');
  };

  const applyCoefficients = async () => {
    if (!confirm('実績から算出した曜日指数を発注係数に反映します。よろしいですか？')) return;
    setBusy('apply');
    const res = await fetch('/api/sales-analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'applyCoefficients', config: { baseDate, periodFrom, periodTo } }),
    }).then((r) => r.json());
    onToast(res.success ? '✓ 指数を係数に反映しました' : res.message);
    if (res.success) await onChanged();
    setBusy('');
  };

  const indices = data?.indices;

  return (
    <div className="calendar-panel flex flex-col h-full">
      <div className="calendar-toolbar">
        <div className="calendar-toolbar-row">
          <div className="segment-control">
            <button type="button" className={`segment-btn ${viewMode === 'week' ? 'active' : ''}`} onClick={() => setViewMode('week')}>
              1週間
            </button>
            <button type="button" className={`segment-btn ${viewMode === 'month' ? 'active' : ''}`} onClick={() => setViewMode('month')}>
              1ヶ月
            </button>
          </div>
          <div className="calendar-nav">
            <button type="button" className="calendar-nav-btn" onClick={() => navigate(-1)}>‹</button>
            <span className="calendar-nav-label">{headerLabel}</span>
            <button type="button" className="calendar-nav-btn" onClick={() => navigate(1)}>›</button>
            <button type="button" className="calendar-today-btn" onClick={() => setAnchorDate(today)}>今日</button>
          </div>
        </div>

        <div className="calendar-toolbar-row calendar-toolbar-row--analysis">
          <label className="calendar-field">
            <span>分析期間</span>
            <div className="calendar-field-range">
              <input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
              <em>〜</em>
              <input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
            </div>
          </label>
          <label className="calendar-field calendar-field--base">
            <span>基準日</span>
            <input type="date" value={baseDate} onChange={(e) => setBaseDate(e.target.value)} />
          </label>
          <button type="button" className="calendar-action-btn" onClick={reloadAnalysis} disabled={!!busy || loading}>
            {loading ? '読込中…' : '指数を再計算'}
          </button>
          <button type="button" className="calendar-action-btn calendar-action-btn--secondary" onClick={saveConfig} disabled={!!busy}>
            設定保存
          </button>
          <button type="button" className="calendar-action-btn calendar-action-btn--secondary" onClick={importHolidays} disabled={!!busy}>
            祝日取込
          </button>
          <button type="button" className="calendar-action-btn calendar-action-btn--apply" onClick={applyCoefficients} disabled={!!busy || !indices}>
            係数に反映
          </button>
        </div>
      </div>

      <div className="calendar-body">
        <div className="calendar-main">
          {viewMode === 'month' && (
            <div className="calendar-weekdays">
              {DAY_ORDER.map((d) => (
                <div key={d} className={`calendar-weekday ${d === '日' ? 'calendar-weekday--sun' : ''} ${d === '土' ? 'calendar-weekday--sat' : ''}`}>{d}</div>
              ))}
            </div>
          )}
          {viewMode === 'week' && (
            <div className="calendar-weekdays calendar-weekdays--week">
              {calendarDays.map((d) => (
                <div key={d} className="calendar-weekday">{dayName(d)}</div>
              ))}
            </div>
          )}

          <div className={`calendar-grid ${viewMode === 'week' ? 'calendar-grid--week' : 'calendar-grid--month'}`}>
            {calendarDays.map((date) => {
              const inMonth = viewMode === 'month' ? date.slice(0, 7) === anchorDate.slice(0, 7) : true;
              const detail = dayMap[date];
              const isBase = date === baseDate;
              const isHoliday = !!holidayMap[date];
              const isWeekend = dayName(date) === '土' || dayName(date) === '日';
              const total = detail?.fullDayTotal ?? 0;
              const idx = detail?.index ?? (isHoliday ? indices?.holiday : indices?.day[dayName(date)]);

              return (
                <button
                  key={date}
                  type="button"
                  className={`calendar-cell ${!inMonth ? 'calendar-cell--muted' : ''} ${isBase ? 'calendar-cell--base' : ''} ${isHoliday ? 'calendar-cell--holiday' : ''} ${isWeekend ? 'calendar-cell--weekend' : ''}`}
                  onClick={() => setBaseDate(date)}
                  title={isHoliday ? holidayMap[date] : 'クリックで基準日に設定'}
                >
                  <div className="calendar-cell-head">
                    <span className="calendar-cell-date">{Number(date.slice(8))}</span>
                    {isHoliday && <span className="calendar-cell-badge">祝</span>}
                    {isBase && <span className="calendar-cell-badge calendar-cell-badge--base">基準</span>}
                  </div>
                  {total > 0 && <div className="calendar-cell-sales">{total.toLocaleString()}</div>}
                  {detail?.hasHalfDay && (
                    <div className="calendar-cell-half">
                      <span>午前 {detail.amTotal || '—'}</span>
                      <span>午後 {detail.pmTotal || '—'}</span>
                    </div>
                  )}
                  {idx != null && total > 0 && (
                    <div className="calendar-cell-index">×{Number(idx).toFixed(2)}</div>
                  )}
                  {isHoliday && <div className="calendar-cell-holiday-name">{holidayMap[date]}</div>}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="calendar-sidebar">
          <section className="calendar-side-card">
            <h3 className="calendar-side-title">曜日指数</h3>
            <p className="calendar-side-hint">
              基準: {baseDate ? `${shortDate(baseDate)}（${dayName(baseDate)}）` : '—'}
              {indices && ` · 平均 ${indices.baseAvg.toLocaleString()}個`}
            </p>
            <div className="calendar-index-grid">
              {DAY_ORDER.map((d) => (
                <div key={d} className="calendar-index-row">
                  <span className="calendar-index-day">{d}</span>
                  <span className="calendar-index-val">×{(indices?.day[d] ?? master.dayCoefficients[d] ?? 1).toFixed(2)}</span>
                  <span className="calendar-index-n">{indices?.sampleCounts[d] ?? 0}日</span>
                </div>
              ))}
              <div className="calendar-index-row calendar-index-row--holiday">
                <span className="calendar-index-day">祝</span>
                <span className="calendar-index-val">×{(indices?.holiday ?? master.dayCoefficients['祝'] ?? 1.3).toFixed(2)}</span>
                <span className="calendar-index-n">{indices?.holidaySampleCount ?? 0}日</span>
              </div>
            </div>
          </section>

          <section className="calendar-side-card">
            <h3 className="calendar-side-title">現在の係数</h3>
            <div className="calendar-index-grid">
              {DAY_ORDER.map((d) => (
                <div key={d} className="calendar-index-row">
                  <span className="calendar-index-day">{d}</span>
                  <span className="calendar-index-val calendar-index-val--muted">×{(master.dayCoefficients[d] ?? 1).toFixed(2)}</span>
                </div>
              ))}
              <div className="calendar-index-row">
                <span className="calendar-index-day">祝</span>
                <span className="calendar-index-val calendar-index-val--muted">×{(master.dayCoefficients['祝'] ?? 1.3).toFixed(2)}</span>
              </div>
            </div>
          </section>

          <section className="calendar-side-card">
            <h3 className="calendar-side-title">半日実績</h3>
            <p className="calendar-side-hint">
              全日実績は sales テーブル、午前/午後は half_day_sales に保存。カレンダーに午前・午後の内訳が表示されます。
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
