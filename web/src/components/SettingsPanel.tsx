'use client';

import { useEffect, useState } from 'react';
import type { MasterData } from '@/types';
import { DAY_ORDER } from '@/lib/coefficients';

interface Props {
  master: MasterData;
  onChanged: () => Promise<void> | void;
  onToast: (msg: string) => void;
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((r) => r.json());
  return res;
}

export default function SettingsPanel({ master, onChanged, onToast }: Props) {
  const [weather, setWeather] = useState<Record<string, number>>(master.weatherCoefficients);
  const [day, setDay] = useState<Record<string, number>>(master.dayCoefficients);
  const [savingCoef, setSavingCoef] = useState(false);

  const [newProduct, setNewProduct] = useState('');
  const [newProductUnit, setNewProductUnit] = useState(1);
  const [newStore, setNewStore] = useState('');
  const [newStoreShort, setNewStoreShort] = useState('');

  const [spStore, setSpStore] = useState(master.storeOrder[0] || '');
  const [addProdToStore, setAddProdToStore] = useState('');
  const [addProdDisplay, setAddProdDisplay] = useState(1);

  useEffect(() => {
    setWeather(master.weatherCoefficients);
    setDay(master.dayCoefficients);
  }, [master]);

  const saveCoef = async () => {
    setSavingCoef(true);
    const res = await post('/api/settings', { weather, day });
    onToast(res.success ? '✓ 係数を保存しました' : res.message);
    if (res.success) await onChanged();
    setSavingCoef(false);
  };

  const act = async (body: Record<string, unknown>, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return;
    const res = await post('/api/master-edit', body);
    onToast(res.success ? `✓ ${res.message}` : res.message);
    if (res.success) await onChanged();
  };

  const storeProducts = master.storeProducts[spStore] || [];
  const productsNotInStore = master.products.filter(
    (p) => !storeProducts.some((sp) => sp.name === p.name)
  );

  return (
    <div className="space-y-4 pb-10">
      {/* 係数 */}
      <section className="settings-card">
        <h3 className="settings-title">曜日係数</h3>
        <p className="settings-hint">曜日ごとの売上変動を数値化（1.0 が基準）。納品曜日に掛かります。</p>
        <div className="grid grid-cols-7 gap-1.5 mt-3">
          {DAY_ORDER.map((d) => (
            <div key={d} className="text-center">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">{d}</label>
              <input
                type="number" step="0.01" min="0"
                value={day[d] ?? 1}
                onChange={(e) => setDay({ ...day, [d]: Number(e.target.value) || 0 })}
                className="coef-input"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="settings-card">
        <h3 className="settings-title">天候係数</h3>
        <p className="settings-hint">天候ごとの補正（曜日係数と掛け合わせて発注数に反映）。</p>
        <div className="flex gap-2 mt-3 flex-wrap">
          {Object.keys(weather).map((w) => (
            <div key={w} className="text-center">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">{w}</label>
              <input
                type="number" step="0.01" min="0"
                value={weather[w] ?? 1}
                onChange={(e) => setWeather({ ...weather, [w]: Number(e.target.value) || 0 })}
                className="coef-input"
              />
            </div>
          ))}
        </div>
        <button onClick={saveCoef} disabled={savingCoef} className="btn-primary-sm mt-4">
          {savingCoef ? '保存中...' : '係数を保存'}
        </button>
      </section>

      {/* 商品マスタ */}
      <section className="settings-card">
        <h3 className="settings-title">商品マスタ（{master.products.length}件）</h3>
        <div className="flex gap-2 mt-2">
          <input
            placeholder="商品名"
            value={newProduct}
            onChange={(e) => setNewProduct(e.target.value)}
            className="settings-text-input flex-1"
          />
          <input
            type="number" min="1" title="発注単位"
            value={newProductUnit}
            onChange={(e) => setNewProductUnit(Number(e.target.value) || 1)}
            className="settings-text-input w-20"
          />
          <button
            onClick={async () => {
              if (!newProduct.trim()) return;
              await act({ action: 'addProduct', name: newProduct.trim(), orderUnit: newProductUnit });
              setNewProduct('');
              setNewProductUnit(1);
            }}
            className="btn-primary-sm shrink-0"
          >
            追加
          </button>
        </div>
        <div className="max-h-52 overflow-y-auto mt-3 divide-y divide-slate-100">
          {master.products.map((p) => (
            <div key={p.name} className="flex items-center justify-between py-1.5 text-sm">
              <span className="truncate flex-1">{p.name}</span>
              <span className="text-[11px] text-slate-400 mx-2">単位{p.orderUnit}</span>
              <button
                onClick={() => act({ action: 'deleteProduct', name: p.name }, `商品「${p.name}」を削除しますか？（実績も削除されます）`)}
                className="btn-delete-sm"
              >
                削除
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 店舗マスタ */}
      <section className="settings-card">
        <h3 className="settings-title">店舗マスタ（{master.storeOrder.length}件）</h3>
        <div className="flex gap-2 mt-2">
          <input
            placeholder="店舗名"
            value={newStore}
            onChange={(e) => setNewStore(e.target.value)}
            className="settings-text-input flex-1"
          />
          <input
            placeholder="略称"
            value={newStoreShort}
            onChange={(e) => setNewStoreShort(e.target.value)}
            className="settings-text-input w-24"
          />
          <button
            onClick={async () => {
              if (!newStore.trim()) return;
              await act({ action: 'addStore', name: newStore.trim(), short: newStoreShort.trim() || newStore.trim().slice(0, 3) });
              setNewStore('');
              setNewStoreShort('');
            }}
            className="btn-primary-sm shrink-0"
          >
            追加
          </button>
        </div>
        <div className="mt-3 divide-y divide-slate-100">
          {master.storeOrder.map((s) => (
            <div key={s} className="flex items-center justify-between py-1.5 text-sm">
              <span className="truncate flex-1">{s}</span>
              <span className="text-[11px] text-slate-400 mx-2">{master.storeShortNames[s]}</span>
              <button
                onClick={() => act({ action: 'deleteStore', name: s }, `店舗「${s}」を削除しますか？（実績も削除されます）`)}
                className="btn-delete-sm"
              >
                削除
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 店舗×商品 陳列数 */}
      <section className="settings-card">
        <h3 className="settings-title">陳列数（店舗別）</h3>
        <select value={spStore} onChange={(e) => setSpStore(e.target.value)} className="settings-text-input w-full mt-2">
          {master.storeOrder.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <div className="flex gap-2 mt-3">
          <select
            value={addProdToStore}
            onChange={(e) => setAddProdToStore(e.target.value)}
            className="settings-text-input flex-1"
          >
            <option value="">取扱商品を追加...</option>
            {productsNotInStore.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
          <input
            type="number" min="0" title="陳列数"
            value={addProdDisplay}
            onChange={(e) => setAddProdDisplay(Number(e.target.value) || 0)}
            className="settings-text-input w-20"
          />
          <button
            onClick={async () => {
              if (!addProdToStore) return;
              await act({ action: 'setStoreProduct', storeName: spStore, productName: addProdToStore, baseDisplay: addProdDisplay });
              setAddProdToStore('');
              setAddProdDisplay(1);
            }}
            className="btn-primary-sm shrink-0"
          >
            追加
          </button>
        </div>

        <div className="max-h-64 overflow-y-auto mt-3 divide-y divide-slate-100">
          {storeProducts.map((sp) => (
            <div key={sp.name} className="flex items-center gap-2 py-1.5 text-sm">
              <span className="truncate flex-1">{sp.name}</span>
              <input
                type="number" min="0"
                defaultValue={sp.baseDisplay}
                onBlur={(e) => {
                  const v = Number(e.target.value) || 0;
                  if (v !== sp.baseDisplay) act({ action: 'setStoreProduct', storeName: spStore, productName: sp.name, baseDisplay: v });
                }}
                className="settings-text-input w-16 text-center"
              />
              <button
                onClick={() => act({ action: 'removeStoreProduct', storeName: spStore, productName: sp.name })}
                className="btn-delete-sm"
              >
                外す
              </button>
            </div>
          ))}
          {!storeProducts.length && <p className="text-center text-slate-400 text-sm py-4">取扱商品なし</p>}
        </div>
      </section>
    </div>
  );
}
