'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MasterData } from '@/types';
import {
  createEmptyGrid,
  loadShelfGrid,
  saveShelfGrid,
  SHELF_COLS,
  SHELF_ROWS,
  type ShelfCell,
  type ShelfGrid,
} from '@/lib/shelf-storage';

interface Props {
  master: MasterData;
  activeStore: string;
  onStoreChange: (store: string) => void;
}

export default function ShelfLayoutPanel({ master, activeStore, onStoreChange }: Props) {
  const [grid, setGrid] = useState<ShelfGrid>(() => createEmptyGrid());
  const [swapFrom, setSwapFrom] = useState<{ r: number; c: number } | null>(null);
  const [pickProduct, setPickProduct] = useState('');

  const products = master.storeProducts[activeStore] || [];

  useEffect(() => {
    setGrid(loadShelfGrid(activeStore));
    setSwapFrom(null);
  }, [activeStore]);

  const persist = useCallback(
    (next: ShelfGrid) => {
      setGrid(next);
      saveShelfGrid(activeStore, next);
    },
    [activeStore]
  );

  const updateCell = (r: number, c: number, patch: Partial<ShelfCell>) => {
    const next = grid.map((row, ri) =>
      row.map((cell, ci) => (ri === r && ci === c ? { ...cell, ...patch } : cell))
    );
    persist(next);
  };

  const onCellClick = (r: number, c: number) => {
    if (!swapFrom) {
      setSwapFrom({ r, c });
      return;
    }
    if (swapFrom.r === r && swapFrom.c === c) {
      setSwapFrom(null);
      return;
    }
    const next = grid.map((row) => row.map((cell) => ({ ...cell })));
    const a = next[swapFrom.r][swapFrom.c];
    const b = next[r][c];
    next[swapFrom.r][swapFrom.c] = { ...b };
    next[r][c] = { ...a };
    persist(next);
    setSwapFrom(null);
  };

  const assignProduct = (r: number, c: number, name: string) => {
    const p = products.find((x) => x.name === name);
    updateCell(r, c, {
      productName: name || null,
      afterSale: p?.baseDisplay ?? 0,
      afterMaintenance: p?.baseDisplay ?? 0,
    });
  };

  return (
    <div className="shelf-layout flex flex-col h-full">
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
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span>{SHELF_ROWS}段 × {SHELF_COLS}列</span>
          {swapFrom && <span className="text-emerald-700 font-bold">入替先をクリック</span>}
          <button type="button" className="btn-primary-sm" onClick={() => setSwapFrom(null)}>入替解除</button>
        </div>
      </div>

      <div className="shelf-toolbar px-3 py-2 bg-white border-b flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-slate-500">商品を割当:</span>
        <select
          value={pickProduct}
          onChange={(e) => setPickProduct(e.target.value)}
          className="settings-text-input text-sm max-w-xs"
        >
          <option value="">選択...</option>
          {products.map((p) => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
        <span className="text-xs text-slate-400">セルをクリックで選択 → もう一度で入替</span>
      </div>

      <div className="shelf-grid-wrap">
        <div className="shelf-grid">
          {grid.map((row, r) =>
            row.map((cell, c) => {
              const selected = swapFrom?.r === r && swapFrom?.c === c;
              const bg = cell.photoUrl ? { backgroundImage: `url(${cell.photoUrl})` } : undefined;
              return (
                <div
                  key={`${r}-${c}`}
                  className={`shelf-cell ${selected ? 'shelf-cell--selected' : ''} ${cell.productName ? 'shelf-cell--filled' : ''}`}
                  style={bg}
                  onClick={() => onCellClick(r, c)}
                >
                  <div className="shelf-cell-pos">{r + 1}-{c + 1}</div>
                  <select
                    className="shelf-cell-product"
                    value={cell.productName || ''}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => assignProduct(r, c, e.target.value)}
                  >
                    <option value="">空</option>
                    {products.map((p) => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                  <label className="shelf-cell-qty">
                    <span>販売後</span>
                    <input
                      type="number" min={0}
                      value={cell.afterSale}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateCell(r, c, { afterSale: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <label className="shelf-cell-qty">
                    <span>メンテ後</span>
                    <input
                      type="number" min={0}
                      value={cell.afterMaintenance}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateCell(r, c, { afterMaintenance: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <input
                    type="url"
                    placeholder="背景写真URL"
                    className="shelf-cell-photo"
                    value={cell.photoUrl}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateCell(r, c, { photoUrl: e.target.value })}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
