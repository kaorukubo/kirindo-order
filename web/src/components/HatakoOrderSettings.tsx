'use client';

import { useMemo, useState } from 'react';
import type { MasterData } from '@/types';
import { writeLocalHatakoFlag } from '@/lib/hatako-order';

interface Props {
  master: MasterData;
  onChanged: () => Promise<void> | void;
  onToast: (msg: string) => void;
  localDev?: boolean;
}

async function post(body: Record<string, unknown>) {
  return fetch('/api/master-edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json());
}

export default function HatakoOrderSettings({ master, onChanged, onToast, localDev }: Props) {
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return master.products;
    return master.products.filter((p) => p.name.includes(q));
  }, [master.products, search]);

  const enabledCount = master.products.filter((p) => master.hatakoOrderSheet[p.name] !== false).length;

  const toggle = async (productName: string, enabled: boolean) => {
    setBusy(productName);
    if (localDev) writeLocalHatakoFlag(productName, enabled);
    else {
      const res = await post({ action: 'setHatakoOrderSheet', productName, enabled });
      onToast(res.success ? `✓ ${res.message}` : res.message);
      if (!res.success) {
        setBusy('');
        return;
      }
    }
    await onChanged();
    setBusy('');
  };

  const setAll = async (enabled: boolean) => {
    if (!confirm(enabled ? '全商品を畑光発注書に掲載しますか？' : '全商品を畑光発注書から除外しますか？')) return;
    setBusy('*');
    for (const p of master.products) {
      if (localDev) writeLocalHatakoFlag(p.name, enabled);
      else await post({ action: 'setHatakoOrderSheet', productName: p.name, enabled });
    }
    await onChanged();
    onToast(enabled ? '✓ 全商品を畑光発注対象にしました' : '✓ 全商品を畑光発注対象外にしました');
    setBusy('');
  };

  return (
    <section className="settings-card">
      <h3 className="settings-title">畑光 発注書（Excel）</h3>
      <p className="settings-hint">
        キリン堂向けの振分計算は全商品対象です。ここで OFF にした商品は、畑光向け Excel の「発注一覧」から除外されます（店舗別振分シートには全商品表示）。
        フォーマットは後日テンプレート差し替え予定です。
      </p>
      <p className="text-xs font-semibold text-emerald-700 mt-2">
        畑光発注対象: {enabledCount} / {master.products.length} 品
      </p>

      <div className="flex flex-wrap gap-2 mt-3">
        <input
          type="search"
          placeholder="商品名で絞り込み…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="settings-text-input flex-1 min-w-[10rem]"
        />
        <button type="button" className="btn-primary-sm" onClick={() => setAll(true)} disabled={!!busy}>
          すべて ON
        </button>
        <button type="button" className="btn-delete-sm" onClick={() => setAll(false)} disabled={!!busy}>
          すべて OFF
        </button>
      </div>

      <div className="max-h-72 overflow-y-auto mt-3 divide-y divide-slate-100">
        {filtered.map((p) => {
          const on = master.hatakoOrderSheet[p.name] !== false;
          return (
            <label key={p.name} className="flex items-center gap-3 py-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={on}
                disabled={busy === p.name || busy === '*'}
                onChange={(e) => toggle(p.name, e.target.checked)}
                className="shrink-0"
              />
              <span className={`truncate flex-1 ${on ? '' : 'text-slate-400 line-through'}`}>{p.name}</span>
              <span className={`text-[10px] font-bold shrink-0 ${on ? 'text-emerald-600' : 'text-slate-400'}`}>
                {on ? '畑光' : '対象外'}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
