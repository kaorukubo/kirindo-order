'use client';

import { useMemo } from 'react';
import type { MasterData } from '@/types';
import { shortDate } from '@/lib/dates';

type StoreState = Record<string, Record<string, { sales: number; loss: number }>>;

interface Props {
  master: MasterData;
  storeState: StoreState;
  activeStore: string;
  lossDate: string;
  onScan: () => void;
}

export default function LossListPanel({ master, storeState, activeStore, lossDate, onScan }: Props) {
  const rows = useMemo(() => {
    const products = master.storeProducts[activeStore] || [];
    return products
      .map((p) => ({
        name: p.name,
        loss: storeState[activeStore]?.[p.name]?.loss ?? 0,
        sales: storeState[activeStore]?.[p.name]?.sales ?? 0,
      }))
      .filter((r) => r.loss > 0)
      .sort((a, b) => b.loss - a.loss || a.name.localeCompare(b.name, 'ja'));
  }, [master, storeState, activeStore]);

  const totalLoss = rows.reduce((a, r) => a + r.loss, 0);

  return (
    <div className="mobile-panel">
      <header className="mobile-panel-head">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="mobile-panel-title">ロス一覧</h2>
            <p className="mobile-panel-sub">
              {master.storeShortNames[activeStore] || activeStore} · ロス日 {lossDate ? shortDate(lossDate) : '—'}
            </p>
          </div>
          <button type="button" className="loss-scan-fab" onClick={onScan}>
            📷 スキャン
          </button>
        </div>
        <p className="loss-list-total">合計 <b>{totalLoss}</b> 個（{rows.length}品目）</p>
      </header>

      <ul className="loss-list">
        {rows.map((r) => (
          <li key={r.name} className="loss-list-item">
            <span className="loss-list-name">{r.name}</span>
            <span className="loss-list-qty">{r.loss}</span>
          </li>
        ))}
        {!rows.length && (
          <li className="mobile-empty">ロス入力はありません。「スキャン」でバーコード読取できます。</li>
        )}
      </ul>
    </div>
  );
}
