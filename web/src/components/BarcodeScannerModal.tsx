'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveProductByBarcode, normalizeBarcode } from '@/lib/barcode';
import { scanErrorFeedback, scanSuccessFeedback, scanUnknownFeedback } from '@/lib/scan-feedback';

const SCANNER_ELEMENT_ID = 'barcode-scanner-viewport';
const DEBOUNCE_MS = 800;

export interface ScanLogEntry {
  id: string;
  barcode: string;
  productName: string | null;
  at: string;
  ok: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  storeName: string;
  storeShortName: string;
  lossDate: string;
  barcodeToProduct: Record<string, string>;
  onOptimisticLoss: (productName: string, barcode: string) => void;
}

export default function BarcodeScannerModal({
  open,
  onClose,
  storeName,
  storeShortName,
  lossDate,
  barcodeToProduct,
  onOptimisticLoss,
}: Props) {
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const pendingSavesRef = useRef(0);
  const [status, setStatus] = useState<'idle' | 'starting' | 'scanning' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [scanCount, setScanCount] = useState(0);
  const [recent, setRecent] = useState<ScanLogEntry[]>([]);
  const [lastHit, setLastHit] = useState<{ productName: string; loss: number } | null>(null);

  const pushLog = useCallback((entry: Omit<ScanLogEntry, 'id' | 'at'>) => {
    setRecent((prev) => [
      { ...entry, id: `${Date.now()}-${Math.random()}`, at: new Date().toLocaleTimeString('ja-JP') },
      ...prev.slice(0, 19),
    ]);
  }, []);

  const saveAsync = useCallback(
    (barcode: string, productName: string) => {
      pendingSavesRef.current += 1;
      fetch('/api/loss-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lossDate, storeName, barcode, productName, delta: 1 }),
      })
        .then((r) => r.json())
        .then((res) => {
          if (!res.success) {
            scanErrorFeedback();
            pushLog({ barcode, productName, ok: false });
            setStatusMsg(res.message || '保存失敗');
          }
        })
        .catch(() => {
          scanErrorFeedback();
          setStatusMsg('ネットワークエラー（端末上の数値は更新済み）');
        })
        .finally(() => {
          pendingSavesRef.current -= 1;
        });
    },
    [lossDate, storeName, pushLog]
  );

  const handleDecode = useCallback(
    (raw: string) => {
      const code = normalizeBarcode(raw);
      if (!code) return;

      const now = Date.now();
      if (lastScanRef.current.code === code && now - lastScanRef.current.at < DEBOUNCE_MS) {
        return;
      }
      lastScanRef.current = { code, at: now };

      const productName = resolveProductByBarcode(code, barcodeToProduct);
      if (!productName) {
        scanUnknownFeedback();
        pushLog({ barcode: code, productName: null, ok: false });
        setStatusMsg(`未登録: ${code}`);
        return;
      }

      scanSuccessFeedback();
      setScanCount((c) => c + 1);
      setLastHit({ productName, loss: 0 });
      setStatusMsg('');
      pushLog({ barcode: code, productName, ok: true });

      // 楽観的更新 — API 待ちなし
      onOptimisticLoss(productName, code);
      saveAsync(code, productName);
    },
    [barcodeToProduct, onOptimisticLoss, pushLog, saveAsync]
  );

  const stopScanner = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      try {
        await s.stop();
      } catch {
        /* already stopped */
      }
    }
  }, []);

  useEffect(() => {
    if (!open) {
      void stopScanner();
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('starting');
    setStatusMsg('カメラを起動中…');
    setScanCount(0);
    setRecent([]);
    setLastHit(null);
    lastScanRef.current = { code: '', at: 0 };

    (async () => {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        if (cancelled) return;

        const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false });
        scannerRef.current = scanner;

        const config = {
          fps: 15,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const w = Math.min(viewfinderWidth * 0.92, 340);
            const h = Math.min(viewfinderHeight * 0.38, 140);
            return { width: w, height: h };
          },
          aspectRatio: 1.777,
          disableFlip: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
          ],
        };

        await scanner.start(
          { facingMode: 'environment' },
          config,
          (text) => {
            if (!cancelled) handleDecode(text);
          },
          () => {
            /* フレームごとの未検出 — 無視 */
          }
        );

        if (!cancelled) {
          setStatus('scanning');
          setStatusMsg('バーコードを枠内に合わせてください');
        }
      } catch (e) {
        if (!cancelled) {
          setStatus('error');
          setStatusMsg((e as Error).message || 'カメラの起動に失敗しました');
        }
      }
    })();

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [open, handleDecode, stopScanner]);

  if (!open) return null;

  const mapCount = Object.keys(barcodeToProduct).length;

  return (
    <div className="scanner-overlay" role="dialog" aria-modal="true" aria-label="ロス連続スキャン">
      <div className="scanner-sheet">
        <header className="scanner-header">
          <div>
            <h2 className="scanner-title">ロス連続スキャン</h2>
            <p className="scanner-sub">
              {storeShortName || storeName} · ロス日 {lossDate || '—'} · 登録 {mapCount}件
            </p>
          </div>
          <button type="button" className="scanner-close" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </header>

        <div className="scanner-viewport-wrap">
          <div id={SCANNER_ELEMENT_ID} className="scanner-viewport" />
          {status === 'starting' && <div className="scanner-viewport-msg">{statusMsg}</div>}
          {status === 'error' && <div className="scanner-viewport-msg scanner-viewport-msg--error">{statusMsg}</div>}
        </div>

        <div className="scanner-stats">
          <div className="scanner-stat">
            <span className="scanner-stat-val">{scanCount}</span>
            <span className="scanner-stat-lbl">スキャン</span>
          </div>
          {lastHit && (
            <div className="scanner-last-hit">
              <span className="scanner-last-label">直前</span>
              <span className="scanner-last-name">{lastHit.productName}</span>
            </div>
          )}
          {statusMsg && status === 'scanning' && <p className="scanner-hint">{statusMsg}</p>}
        </div>

        <div className="scanner-log">
          <p className="scanner-log-title">履歴</p>
          <ul className="scanner-log-list">
            {recent.map((e) => (
              <li key={e.id} className={e.ok ? 'scanner-log-ok' : 'scanner-log-ng'}>
                <span className="scanner-log-time">{e.at}</span>
                {e.ok ? (
                  <span>{e.productName}</span>
                ) : (
                  <span>未登録 {e.barcode}</span>
                )}
              </li>
            ))}
            {!recent.length && <li className="scanner-log-empty">スキャン待機中…</li>}
          </ul>
        </div>

        <p className="scanner-footnote">
          同一バーコードは {DEBOUNCE_MS / 1000} 秒間は再カウントしません。ラベルタブでバーコード未登録の商品を先に設定してください。
        </p>
      </div>
    </div>
  );
}
