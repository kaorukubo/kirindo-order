'use client';

import { useState } from 'react';
import type { CalcItem, MasterData } from '@/types';
import StaffNameBar from '@/components/StaffNameBar';
import DeliverySummaryPanel from '@/components/DeliverySummaryPanel';
import LossListPanel from '@/components/LossListPanel';
import ShelfPhotoPanel from '@/components/ShelfPhotoPanel';
import BarcodeScannerModal from '@/components/BarcodeScannerModal';
import { shortDate, getDeliveryDate } from '@/lib/dates';

type MobileTab = 'delivery' | 'loss' | 'photos' | 'account';
type StoreState = Record<string, Record<string, { sales: number; loss: number }>>;

interface Props {
  master: MasterData;
  orderDate: string;
  lossDate: string;
  weather: string;
  storeState: StoreState;
  activeStoreIdx: number;
  setActiveStoreIdx: (i: number) => void;
  results: CalcItem[] | null;
  computeResults: () => CalcItem[] | null;
  barcodeMap: Record<string, string>;
  onOptimisticLossScan: (productName: string) => void;
  onLogout: () => void;
  onToast: (msg: string) => void;
}

const TABS: { key: MobileTab; label: string; icon: string }[] = [
  { key: 'delivery', label: '納品', icon: '📦' },
  { key: 'loss', label: 'ロス', icon: '📋' },
  { key: 'photos', label: '棚写真', icon: '📷' },
  { key: 'account', label: '担当', icon: '👤' },
];

export default function MobileOrderApp({
  master,
  orderDate,
  lossDate,
  weather,
  storeState,
  activeStoreIdx,
  setActiveStoreIdx,
  results,
  computeResults,
  barcodeMap,
  onOptimisticLossScan,
  onLogout,
  onToast,
}: Props) {
  const [tab, setTab] = useState<MobileTab>('delivery');
  const [scannerOpen, setScannerOpen] = useState(false);

  const activeStore = master.storeOrder[activeStoreIdx];

  return (
    <div className="mobile-shell">
      <header className="mobile-top">
        <div className="mobile-top-brand">
          <span className="mobile-top-title">Kirindo 青果</span>
          <span className="mobile-top-date">納品 {shortDate(getDeliveryDate(orderDate))}</span>
        </div>
        <StaffNameBar compact />
      </header>

      {(tab === 'loss' || tab === 'account') && (
        <div className="mobile-store-tabs">
          {master.storeOrder.map((store, i) => (
            <button
              key={store}
              type="button"
              className={`mobile-store-tab ${i === activeStoreIdx ? 'active' : ''}`}
              onClick={() => setActiveStoreIdx(i)}
            >
              {master.storeShortNames[store] || store}
            </button>
          ))}
        </div>
      )}

      <main className="mobile-main">
        {tab === 'delivery' && (
          <DeliverySummaryPanel
            master={master}
            orderDate={orderDate}
            weather={weather}
            results={results}
            onCompute={computeResults}
          />
        )}
        {tab === 'loss' && (
          <LossListPanel
            master={master}
            storeState={storeState}
            activeStore={activeStore}
            lossDate={lossDate}
            onScan={() => {
              if (!lossDate) {
                onToast('ロス確認日が未設定です');
                return;
              }
              setScannerOpen(true);
            }}
          />
        )}
        {tab === 'photos' && (
          <ShelfPhotoPanel
            master={master}
            activeStore={activeStore}
            onStoreChange={(s) => {
              const i = master.storeOrder.indexOf(s);
              if (i >= 0) setActiveStoreIdx(i);
            }}
            onToast={onToast}
          />
        )}
        {tab === 'account' && (
          <div className="mobile-panel">
            <header className="mobile-panel-head">
              <h2 className="mobile-panel-title">担当者・店舗</h2>
            </header>
            <div className="mobile-account-card">
              <StaffNameBar />
              <p className="text-xs text-slate-500 mt-4">選択中の店舗</p>
              <p className="text-lg font-bold text-emerald-800">{activeStore}</p>
              <p className="text-sm text-slate-600">{master.storeShortNames[activeStore]}</p>
            </div>
            <div className="mobile-account-card mt-3">
              <p className="text-xs text-slate-500">スマホ版でできること</p>
              <ul className="mobile-feature-list">
                <li>各店舗の納品数確認</li>
                <li>ロス一覧・バーコード連続スキャン</li>
                <li>棚写真（陳列前/後）の撮影・閲覧</li>
              </ul>
              <p className="text-xs text-slate-400 mt-3">発注入力・設定・Excel出力はPC版をご利用ください。</p>
            </div>
            <button type="button" className="logout-btn mt-4 w-full" onClick={onLogout}>ログアウト</button>
          </div>
        )}
      </main>

      <nav className="mobile-bottom-nav">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`mobile-nav-item ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <span className="mobile-nav-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        storeName={activeStore}
        storeShortName={master.storeShortNames[activeStore] || activeStore}
        lossDate={lossDate}
        barcodeToProduct={barcodeMap}
        onOptimisticLoss={onOptimisticLossScan}
      />
    </div>
  );
}
