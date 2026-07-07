'use client';

import { useEffect, useState } from 'react';
import { dayName, shortDate } from '@/lib/dates';

interface HistoryData {
  product: string;
  orderUnit: number;
  stores: { name: string; short: string }[];
  dates: string[];
  byDate: Record<string, Record<string, { sales: number; loss: number }>>;
  totalByStore: Record<string, number>;
}

export default function ProductHistoryPanel({ product }: { product: string | null }) {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!product) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/product-history?product=${encodeURIComponent(product)}&days=42`)
      .then((r) => r.json())
      .then((res) => setData(res.success ? res : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [product]);

  if (!product) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 text-slate-400">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3 text-2xl">📊</div>
        <p className="text-sm font-medium text-slate-500">商品をクリック</p>
        <p className="text-xs mt-1">各店舗がいつ・どれだけ売れたかを表示します</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || !data.dates.length) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="font-bold text-slate-800 text-sm truncate">{product}</p>
        </div>
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">実績データなし</div>
      </div>
    );
  }

  const totalAll = Object.values(data.totalByStore).reduce((a, b) => a + b, 0);
  const maxVal = Math.max(
    1,
    ...data.dates.flatMap((d) => data.stores.map((s) => data.byDate[d]?.[s.name]?.sales || 0))
  );

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <p className="font-bold text-slate-800 text-sm leading-tight">{data.product}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">直近42日 · 発注単位 {data.orderUnit} · 合計 {totalAll}個</p>
        <div className="flex gap-1.5 mt-2 flex-wrap">
          {data.stores.map((s) => (
            <span key={s.name} className="text-[10px] px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold">
              {s.short}: {data.totalByStore[s.name] || 0}
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-50 z-10">
            <tr className="text-slate-400">
              <th className="text-left font-semibold px-3 py-2">日付</th>
              {data.stores.map((s) => (
                <th key={s.name} className="text-center font-semibold px-1 py-2">{s.short}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.dates.map((d, i) => (
              <tr key={d} className={i % 2 ? 'bg-slate-50/60' : 'bg-white'}>
                <td className="px-3 py-1.5 whitespace-nowrap">
                  <span className="font-semibold text-slate-700">{shortDate(d)}</span>
                  <span className="text-slate-300 ml-1">{dayName(d)}</span>
                </td>
                {data.stores.map((s) => {
                  const v = data.byDate[d]?.[s.name]?.sales || 0;
                  const intensity = v / maxVal;
                  return (
                    <td key={s.name} className="text-center px-1 py-1.5">
                      <span
                        className="inline-block min-w-7 px-1.5 py-0.5 rounded-md font-bold tabular-nums"
                        style={{
                          background: v ? `rgba(16,185,129,${0.12 + intensity * 0.5})` : 'transparent',
                          color: v ? '#065f46' : '#cbd5e1',
                        }}
                      >
                        {v}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
