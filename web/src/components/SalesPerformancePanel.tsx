'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MasterData } from '@/types';
import {
  calcDeviation,
  loadProductMetrics,
  saveProductMetrics,
  type ProductMetrics,
} from '@/lib/shelf-storage';

type StoreState = Record<string, Record<string, { sales: number; loss: number }>>;

interface Props {
  master: MasterData;
  storeState: StoreState;
  activeStore: string;
  onStoreChange: (store: string) => void;
}

export default function SalesPerformancePanel({ master, storeState, activeStore, onStoreChange }: Props) {
  const [metrics, setMetrics] = useState<Record<string, ProductMetrics>>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    setMetrics(loadProductMetrics());
  }, []);

  const products = master.storeProducts[activeStore] || [];
  const filtered = products.filter((p) => !search || p.name.includes(search));

  const rows = useMemo(() => {
    return filtered.map((p) => {
      const st = storeState[activeStore]?.[p.name] || { sales: 0, loss: 0 };
      const m = metrics[p.name] || { cost: 0, price: 0, tenantFeePct: 10 };
      const gross = m.price - m.cost;
      const margin = m.price > 0 ? (gross / m.price) * 100 : 0;
      const lossRate = st.sales + st.loss > 0 ? (st.loss / (st.sales + st.loss)) * 100 : 0;
      const deviation = calcDeviation(p.baseDisplay, st.sales);
      const tenantFee = m.price * (m.tenantFeePct / 100);
      const netProfit = gross - tenantFee;
      return { p, st, m, gross, margin, lossRate, deviation, tenantFee, netProfit };
    });
  }, [filtered, storeState, activeStore, metrics]);

  const updateMetric = (name: string, patch: Partial<ProductMetrics>) => {
    setMetrics((prev) => {
      const next = {
        ...prev,
        [name]: { ...{ cost: 0, price: 0, tenantFeePct: 10 }, ...prev[name], ...patch },
      };
      saveProductMetrics(next);
      return next;
    });
  };

  return (
    <div className="sales-perf flex flex-col h-full">
      <div className="pane-header justify-between flex-wrap gap-2">
        <div className="segment-control">
          {master.storeOrder.map((store) => (
            <button
              key={store}
              type="button"
              onClick={() => onStoreChange(store)}
              className={`segment-btn ${store === activeStore ? 'active' : ''}`}
            >
              {master.storeShortNames[store] || store}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="商品検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="settings-text-input w-48"
        />
      </div>

      <div className="sales-perf-scroll">
        <table className="sales-perf-table">
          <thead>
            <tr>
              <th>商品</th>
              <th>適正陳列</th>
              <th>販売数</th>
              <th>乖離%</th>
              <th>原価</th>
              <th>売価</th>
              <th>粗利</th>
              <th>利益率%</th>
              <th>手数料%</th>
              <th>ロス率%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, st, m, gross, margin, lossRate, deviation }) => (
              <tr key={p.name}>
                <td className="sales-perf-name">{p.name}</td>
                <td className="text-center">{p.baseDisplay}</td>
                <td className="text-center font-bold text-emerald-700">{st.sales}</td>
                <td className={`text-center font-bold ${deviation >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  {deviation > 0 ? '+' : ''}{deviation}%
                </td>
                <td>
                  <input
                    type="number" min={0} className="metric-input"
                    value={m.cost || ''}
                    onChange={(e) => updateMetric(p.name, { cost: Number(e.target.value) || 0 })}
                  />
                </td>
                <td>
                  <input
                    type="number" min={0} className="metric-input"
                    value={m.price || ''}
                    onChange={(e) => updateMetric(p.name, { price: Number(e.target.value) || 0 })}
                  />
                </td>
                <td className="text-right font-semibold">{gross.toLocaleString()}</td>
                <td className="text-right">{margin.toFixed(1)}</td>
                <td>
                  <input
                    type="number" min={0} max={100} step={0.1} className="metric-input metric-input--sm"
                    value={m.tenantFeePct}
                    onChange={(e) => updateMetric(p.name, { tenantFeePct: Number(e.target.value) || 0 })}
                  />
                </td>
                <td className="text-right text-orange-600">{lossRate.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sales-perf-hint px-4 py-2 text-xs text-slate-500 border-t bg-white">
        乖離% = (販売数 − 適正陳列) ÷ 適正陳列 × 100。原価・売価・手数料%はローカル保存（今後DB連携予定）。
      </p>
    </div>
  );
}
