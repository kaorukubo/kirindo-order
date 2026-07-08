'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CalcItem, MasterData } from '@/types';
import { addDays, dayName, fmt, getDeliveryDate, shortDate } from '@/lib/dates';
import { calcAllProducts } from '@/lib/calculation';
import { downloadOrderExcel } from '@/lib/excel-export';
import DateControlBar from '@/components/DateControlBar';
import NumberStepper from '@/components/NumberStepper';
import ProductHistoryPanel from '@/components/ProductHistoryPanel';
import SalesPerformancePanel from '@/components/SalesPerformancePanel';
import SettingsPanel from '@/components/SettingsPanel';
import ShelfLayoutPanel from '@/components/ShelfLayoutPanel';
import CalendarPanel from '@/components/CalendarPanel';
import LabelPanel from '@/components/LabelPanel';
import BarcodeScannerModal from '@/components/BarcodeScannerModal';
import TestModeBar from '@/components/TestModeBar';
import OrderLogPanel from '@/components/OrderLogPanel';
import { normalizeBarcode } from '@/lib/barcode';
import { injectTestLossData, type OrderSnapshot } from '@/lib/order-snapshot';

type Screen = 'input' | 'result' | 'shelf' | 'history' | 'sales' | 'calendar' | 'label' | 'logs' | 'settings';
type StoreState = Record<string, Record<string, { sales: number; loss: number }>>;

const NAV: { key: Screen; label: string; icon: string }[] = [
  { key: 'input', label: '入力', icon: '✎' },
  { key: 'result', label: '確認', icon: '☑' },
  { key: 'shelf', label: '棚割り', icon: '▦' },
  { key: 'history', label: '商品別売上', icon: '📈' },
  { key: 'sales', label: '販売実績', icon: '💴' },
  { key: 'calendar', label: '指数・カレンダー', icon: '📅' },
  { key: 'label', label: 'ラベル', icon: '🏷' },
  { key: 'logs', label: '操作ログ', icon: '📋' },
  { key: 'settings', label: '設定', icon: '⚙' },
];

export default function OrderApp() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [master, setMaster] = useState<MasterData | null>(null);
  const [screen, setScreen] = useState<Screen>('input');
  const [orderDate, setOrderDate] = useState(fmt(new Date()));
  const [salesDate, setSalesDate] = useState('');
  const [lossDate, setLossDate] = useState('');
  const [weather, setWeather] = useState('');
  const [storeState, setStoreState] = useState<StoreState>({});
  const [activeStoreIdx, setActiveStoreIdx] = useState(0);
  const [results, setResults] = useState<CalcItem[] | null>(null);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [sortKey, setSortKey] = useState<'default' | 'name' | 'display' | 'sales'>('default');
  const [inputSearch, setInputSearch] = useState('');
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  const [scannerOpen, setScannerOpen] = useState(false);
  const [barcodeMap, setBarcodeMap] = useState<Record<string, string>>({});
  const [testMode, setTestMode] = useState(false);
  const loadedKeyRef = useRef('');

  useEffect(() => {
    try {
      setTestMode(sessionStorage.getItem('kirindo-test-mode') === '1');
    } catch {
      /* ignore */
    }
  }, []);

  const setTestModePersist = (v: boolean) => {
    setTestMode(v);
    try {
      sessionStorage.setItem('kirindo-test-mode', v ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  const jumpToProduct = (name: string) => {
    const el = document.getElementById(`si-${name}`) as HTMLInputElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus();
      el.select();
      setSelectedProduct(name);
    }
  };

  const onInputSearchSubmit = () => {
    if (!master || !inputSearch.trim()) return;
    const q = inputSearch.trim();
    const list = master.storeProducts[master.storeOrder[activeStoreIdx]] || [];
    const hit = list.find((p) => p.name.includes(q)) || list.find((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    if (hit) jumpToProduct(hit.name);
    else showToast('該当商品なし');
  };

  const loadBarcodeMap = useCallback(async () => {
    const res = await fetch('/api/barcode-map').then((r) => r.json());
    const map: Record<string, string> = res.success ? { ...res.map } : {};
    try {
      const local = JSON.parse(localStorage.getItem('kirindo-label-info-v1') || '{}') as Record<
        string,
        { barcode?: string }
      >;
      for (const [name, info] of Object.entries(local)) {
        const code = normalizeBarcode(info.barcode || '');
        if (code) map[code] = name;
      }
    } catch {
      /* ignore */
    }
    setBarcodeMap(map);
    return map;
  }, []);

  const openLossScanner = async () => {
    if (!lossDate) {
      showToast('ロス確認日を設定してください');
      return;
    }
    await loadBarcodeMap();
    setScannerOpen(true);
  };

  const onOptimisticLossScan = useCallback(
    (productName: string) => {
      const store = master?.storeOrder[activeStoreIdx];
      if (!store) return;
      setStoreState((prev) => {
        const st = prev[store]?.[productName] || { sales: 0, loss: 0 };
        return {
          ...prev,
          [store]: {
            ...prev[store],
            [productName]: { ...st, loss: st.loss + 1 },
          },
        };
      });
      setSelectedProduct(productName);
    },
    [master, activeStoreIdx]
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const initState = useCallback((m: MasterData) => {
    const st: StoreState = {};
    m.storeOrder.forEach((store) => {
      st[store] = {};
      (m.storeProducts[store] || []).forEach((p) => {
        st[store][p.name] = { sales: 0, loss: 0 };
      });
    });
    setStoreState(st);
  }, []);

  const loadStoreInputs = useCallback(async (sd: string, ld: string, m: MasterData, showMsg = false) => {
    if (!sd || !ld) return;
    const res = await fetch(`/api/store-input?salesDate=${sd}&lossDate=${ld}`).then((r) => r.json());
    if (!res.success) {
      if (showMsg) showToast(res.message);
      return;
    }
    setStoreState(() => {
      const next: StoreState = {};
      m.storeOrder.forEach((store) => {
        next[store] = {};
        (m.storeProducts[store] || []).forEach((p) => {
          const s = res.sales?.[store]?.[p.name];
          const l = res.losses?.[store]?.[p.name];
          next[store][p.name] = { sales: s != null ? s : 0, loss: l != null ? l : 0 };
        });
      });
      return next;
    });
    if (showMsg) showToast('実績を読み込みました');
  }, []);

  const loadMaster = useCallback(async () => {
    setError('');
    try {
      let res = await fetch('/api/master').then((r) => r.json());
      if (!res.success) {
        const setup = await fetch('/api/setup', { method: 'POST' }).then((r) => r.json());
        if (!setup.success) throw new Error(setup.message);
        res = await fetch('/api/master').then((r) => r.json());
      }
      if (!res.success) throw new Error(res.message);
      setMaster(res);
      if (Object.keys(storeState).length === 0) initState(res);
      if (!weather && res.weatherOptions?.length) setWeather(res.weatherOptions[0]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initState]);

  useEffect(() => {
    const od = fmt(new Date());
    setOrderDate(od);
    setSalesDate(addDays(od, -1));
    setLossDate(addDays(od, 1));
    loadMaster();
  }, [loadMaster]);

  useEffect(() => {
    if (!master || !orderDate) return;
    fetch(`/api/weather?orderDate=${orderDate}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.weather) {
          setWeather(res.weather);
        }
      })
      .catch(() => {});
  }, [master, orderDate]);

  useEffect(() => {
    const from = addDays(fmt(new Date()), -400);
    const to = addDays(fmt(new Date()), 400);
    fetch(`/api/holidays?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.holidays) {
          setHolidayDates(new Set(res.holidays.map((h: { holiday_date: string }) => h.holiday_date)));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!master || !salesDate || !lossDate) return;
    // 日付が実際に変わったときだけ自動読込。画面切替やマスタ再取得では入力値を保持する。
    const key = `${salesDate}|${lossDate}`;
    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;
    loadStoreInputs(salesDate, lossDate, master);
  }, [master, salesDate, lossDate, loadStoreInputs]);

  const onOrderDateChange = (od: string) => {
    setOrderDate(od);
    setSalesDate(addDays(od, -1));
    setLossDate(addDays(od, 1));
  };

  const computeResults = useCallback(() => {
    if (!master) return null;
    const delivery = getDeliveryDate(orderDate);
    const dn: string = holidayDates.has(delivery) ? '祝' : dayName(delivery);
    const w = weather || master.weatherOptions[0] || '晴れ';
    return calcAllProducts(master, storeState, dn, w);
  }, [master, orderDate, weather, storeState, holidayDates]);

  const onCalculate = () => {
    const r = computeResults();
    if (r) {
      setResults(r);
      setScreen('result');
    }
  };

  const goToScreen = (s: Screen) => {
    if (s === 'result' && !results) {
      const r = computeResults();
      if (r) setResults(r);
    }
    setScreen(s);
  };

  const selectProduct = (name: string) => {
    setSelectedProduct(name);
    setScreen('history');
  };

  const onSave = async () => {
    if (!master || !results) return;
    setBusy(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetDate: getDeliveryDate(orderDate),
          orderDate,
          salesDate,
          lossDate,
          weather,
          storeOrder: master.storeOrder,
          storeState,
          results,
          items: results.filter((it) => it.totalUnits > 0),
          testMode,
        }),
      }).then((r) => r.json());
      showToast(res.success ? `✓ ${res.message}` : res.message);
    } finally {
      setBusy(false);
    }
  };

  const injectTestData = () => {
    if (!master) return;
    setStoreState(injectTestLossData(storeState, master.storeOrder, master.storeProducts));
    loadedKeyRef.current = `${salesDate}|${lossDate}`;
    showToast('✓ 全店舗・全商品のロス数にテスト値（0〜5）を注入しました');
    setScreen('input');
  };

  const restoreFromSnapshot = (snapshot: OrderSnapshot) => {
    setOrderDate(snapshot.orderDate);
    setSalesDate(snapshot.salesDate);
    setLossDate(snapshot.lossDate);
    setWeather(snapshot.weather);
    setStoreState(snapshot.storeState);
    setResults(snapshot.results);
    loadedKeyRef.current = `${snapshot.salesDate}|${snapshot.lossDate}`;
    setScreen('input');
  };

  const onExport = () => {
    if (!master || !results) return;
    downloadOrderExcel(results, master.storeOrder, master.storeShortNames, orderDate, getDeliveryDate(orderDate), weather);
    showToast('✓ Excelをダウンロードしました');
  };

  const onImportCsv = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setImportProgress('取込中...');
    try {
      const form = new FormData();
      Array.from(files).forEach((f) => form.append('files', f));
      const res = await fetch('/api/import-sales', { method: 'POST', body: form }).then((r) => r.json());
      if (res.success) {
        showToast(`✓ ${res.message}`);
        await loadMaster();
        if (master) await loadStoreInputs(salesDate, lossDate, master);
      } else {
        showToast(res.message);
      }
    } finally {
      setBusy(false);
      setImportProgress('');
    }
  };

  const onLogout = async () => {
    await fetch('/api/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-[3px] border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
        <p className="mt-4 text-slate-500 text-sm font-medium">読込中...</p>
      </div>
    );
  }

  if (error || !master) {
    return (
      <div className="mx-3 mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 max-w-lg">
        <p className="font-bold">エラー</p>
        <p className="text-sm mt-1">{error || 'マスタ読込失敗'}</p>
        <p className="text-xs mt-2 text-gray-600">Supabase の環境変数を設定し、SQL マイグレーションを実行してください。</p>
        <button onClick={loadMaster} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold">再試行</button>
      </div>
    );
  }

  const deliveryDate = getDeliveryDate(orderDate);
  const deliveryDay = dayName(deliveryDate);
  const activeStore = master.storeOrder[activeStoreIdx];
  const matrixItems = (results || []).filter((it) => showAllProducts || it.totalUnits > 0);

  const dateBarProps = {
    master,
    orderDate,
    salesDate,
    lossDate,
    weather,
    holidayDates,
    onOrderDateChange,
    onSalesDateChange: setSalesDate,
    onLossDateChange: setLossDate,
    onWeatherChange: setWeather,
  };

  return (
    <div className="app-shell">
      {/* ─── LEFT PANE ─── */}
      <aside className="pane-left pane-left--menu">
        <div className="px-3 pt-4 pb-2">
          <p className="text-white/45 text-[9px] font-semibold tracking-[0.2em] uppercase">Kirindo</p>
          <h1 className="text-white text-sm font-bold tracking-tight">青果 発注・振分</h1>
        </div>

        <nav className="px-2 flex-1 space-y-0.5">
          {NAV.map((n) => (
            <button key={n.key} onClick={() => goToScreen(n.key)} className={`nav-item ${screen === n.key ? 'active' : ''}`}>
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>

        <div className="px-2 pb-3 mt-auto">
          <button onClick={onLogout} className="logout-btn">ログアウト</button>
        </div>
      </aside>

      {/* ─── CONTENT ─── */}
      <main className="pane-content">
        <TestModeBar
          testMode={testMode}
          onTestModeChange={setTestModePersist}
          onInjectTestData={injectTestData}
        />
        {screen === 'input' && (
          <div className="flex flex-col h-full">
            <DateControlBar {...dateBarProps} />
            <div className="pane-header">
              <div className="segment-control">
                {master.storeOrder.map((store, i) => (
                  <button key={store} type="button" onClick={() => setActiveStoreIdx(i)} className={`segment-btn ${i === activeStoreIdx ? 'active' : ''}`}>
                    {master.storeShortNames[store] || store}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => loadStoreInputs(salesDate, lossDate, master, true)}
                className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-lg shrink-0 transition-colors"
              >
                実績読込
              </button>
              <button type="button" onClick={onCalculate} className="btn-calculate-sm shrink-0">
                発注を計算
              </button>
              <button
                type="button"
                onClick={openLossScanner}
                className="text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 px-3 py-2 rounded-lg shrink-0 transition-colors"
              >
                📷 ロススキャン
              </button>
            </div>

            <div className="input-toolbar">
              <div className="input-search">
                <input
                  type="search"
                  placeholder="商品を検索して入力欄へジャンプ..."
                  value={inputSearch}
                  onChange={(e) => setInputSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onInputSearchSubmit();
                    }
                  }}
                />
                <button type="button" onClick={onInputSearchSubmit}>検索</button>
              </div>
              <div className="input-sort">
                <span>並べ替え</span>
                <select value={sortKey} onChange={(e) => setSortKey(e.target.value as typeof sortKey)}>
                  <option value="default">標準</option>
                  <option value="name">商品名順</option>
                  <option value="display">適正陳列多い順</option>
                  <option value="sales">販売数多い順</option>
                </select>
              </div>
            </div>

            {(() => {
              const base = master.storeProducts[activeStore] || [];
              const products = [...base];
              if (sortKey === 'name') products.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
              else if (sortKey === 'display') products.sort((a, b) => b.baseDisplay - a.baseDisplay);
              else if (sortKey === 'sales')
                products.sort(
                  (a, b) =>
                    (storeState[activeStore]?.[b.name]?.sales || 0) - (storeState[activeStore]?.[a.name]?.sales || 0)
                );
              const perCol = Math.ceil(products.length / 3);
              const columns = [
                products.slice(0, perCol),
                products.slice(perCol, perCol * 2),
                products.slice(perCol * 2),
              ];
              return (
                <div className="input-cols">
                  {columns.map((col, ci) => (
                    <div key={ci} className="input-col">
                      <div className="grid-head">
                        <span>商品</span>
                        <span className="text-center text-emerald-600">{salesDate ? shortDate(salesDate) : '販売'} 販売数</span>
                        <span className="text-center text-orange-500">{lossDate ? shortDate(lossDate) : 'ロス'} ロス・回収</span>
                      </div>
                      <div className="input-col-body">
                        {col.map((p) => {
                          const st = storeState[activeStore]?.[p.name] || { sales: 0, loss: 0 };
                          const sel = selectedProduct === p.name;
                          return (
                            <div key={p.name} className={`prow ${sel ? 'prow--sel' : ''}`}>
                              <div className="prow-name">
                                <button type="button" onClick={() => selectProduct(p.name)} className="prow-title-btn" title="売上実績を見る">
                                  {p.name}
                                </button>
                                <button type="button" onClick={() => setScreen('settings')} className="prow-badge" title="適正陳列数を設定">
                                  適正 {p.baseDisplay}
                                </button>
                              </div>
                              <NumberStepper
                                compact variant="sales" value={st.sales} inputId={`si-${p.name}`}
                                onChange={(v) => setStoreState((prev) => ({ ...prev, [activeStore]: { ...prev[activeStore], [p.name]: { ...st, sales: v } } }))}
                              />
                              <NumberStepper
                                compact variant="loss" value={st.loss}
                                onChange={(v) => setStoreState((prev) => ({ ...prev, [activeStore]: { ...prev[activeStore], [p.name]: { ...st, loss: v } } }))}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {screen === 'shelf' && (
          <ShelfLayoutPanel
            master={master}
            activeStore={activeStore}
            onStoreChange={(store) => setActiveStoreIdx(master.storeOrder.indexOf(store))}
          />
        )}

        {screen === 'sales' && (
          <SalesPerformancePanel
            master={master}
            storeState={storeState}
            activeStore={activeStore}
            onStoreChange={(store) => setActiveStoreIdx(master.storeOrder.indexOf(store))}
          />
        )}

        {screen === 'calendar' && (
          <CalendarPanel master={master} onChanged={loadMaster} onToast={showToast} />
        )}

        {screen === 'history' && (
          <div className="history-layout">
            <div className="history-picker">
              <div className="pane-header">
                <input
                  type="text"
                  placeholder="商品を検索..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="settings-text-input w-full"
                />
              </div>
              <div className="flex-1 overflow-y-auto">
                {master.products
                  .filter((p) => !historySearch || p.name.includes(historySearch))
                  .map((p) => (
                    <button
                      key={p.name}
                      onClick={() => setSelectedProduct(p.name)}
                      className={`history-pick-item ${selectedProduct === p.name ? 'active' : ''}`}
                    >
                      {p.name}
                    </button>
                  ))}
              </div>
            </div>
            <div className="history-detail">
              <ProductHistoryPanel product={selectedProduct} />
            </div>
          </div>
        )}

        {screen === 'result' && results && (
          <div className="flex flex-col h-full">
            <div className="pane-header justify-between">
              <p className="text-sm font-bold text-slate-700">
                発注 {shortDate(orderDate)} → 納品 {shortDate(deliveryDate)}（{deliveryDay}）· {weather}
              </p>
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                <input type="checkbox" checked={showAllProducts} onChange={(e) => setShowAllProducts(e.target.checked)} />
                0も表示
              </label>
            </div>

            {(() => {
              const editAlloc = (origIdx: number, si: number, v: number) =>
                setResults((prev) => {
                  if (!prev) return prev;
                  const next = [...prev];
                  const it = { ...next[origIdx] };
                  it.allocations = [...it.allocations];
                  it.allocations[si] = v;
                  it.totalUnits = it.allocations.reduce((a, b) => a + b, 0);
                  it.cases = Math.floor(it.totalUnits / it.orderUnit);
                  it.remainder = it.totalUnits % it.orderUnit;
                  next[origIdx] = it;
                  return next;
                });
              const perCol = Math.ceil(matrixItems.length / 3);
              const groups = [
                matrixItems.slice(0, perCol),
                matrixItems.slice(perCol, perCol * 2),
                matrixItems.slice(perCol * 2),
              ];
              return (
                <div className="matrix-cols">
                  {groups.map((group, gi) => (
                    <div key={gi} className="matrix-col">
                      <table className="matrix-table matrix-compact w-full">
                        <thead>
                          <tr>
                            <th className="sticky-col text-left pl-3">商品</th>
                            <th className="text-center">計</th>
                            {master.storeOrder.map((s) => (
                              <th key={s} className="text-center">{master.storeShortNames[s] || s.slice(0, 4)}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {group.map((item) => {
                            const origIdx = results.indexOf(item);
                            return (
                              <tr key={item.productName}>
                                <td className="sticky-col pl-3">
                                  <button onClick={() => selectProduct(item.productName)} className="text-left w-full">
                                    <span className="font-medium text-xs truncate block">{item.productName}</span>
                                    <span className="text-[10px] text-gray-400">{item.cases}cs</span>
                                  </button>
                                </td>
                                <td className="text-center font-bold text-green-700 text-sm">{item.totalUnits}</td>
                                {item.allocations.map((val, si) => (
                                  <td key={si} className="text-center">
                                    <input
                                      type="number" min={0} value={val}
                                      onChange={(e) => editAlloc(origIdx, si, Number(e.target.value) || 0)}
                                      className="matrix-input"
                                    />
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                          {!group.length && (
                            <tr><td colSpan={2 + master.storeOrder.length} className="text-center text-slate-400 py-6 text-sm">なし</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="flex gap-2 p-2 border-t border-slate-100 bg-white">
              <button onClick={() => setScreen('input')} className="h-10 px-4 bg-slate-200 text-slate-700 rounded-lg font-bold text-sm">入力へ戻る</button>
              <button onClick={onExport} className="flex-1 h-10 bg-emerald-600 text-white rounded-lg font-bold shadow text-sm">Excel書き出し</button>
              <button onClick={onSave} className={`flex-1 h-10 rounded-lg font-bold shadow text-sm ${testMode ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'}`}>
                {testMode ? 'テスト確定' : '確定保存'}
              </button>
            </div>
          </div>
        )}

        {screen === 'label' && (
          <LabelPanel
            master={master}
            onLabelsIssued={(labels) => setMaster({ ...master, weeklyLabels: labels })}
            onToast={showToast}
            onImportCsv={onImportCsv}
            importProgress={importProgress}
          />
        )}

        {screen === 'settings' && (
          <div className="p-4 overflow-y-auto h-full max-w-2xl">
            <SettingsPanel master={master} onChanged={loadMaster} onToast={showToast} />
          </div>
        )}

        {screen === 'logs' && (
          <OrderLogPanel onRestore={restoreFromSnapshot} onToast={showToast} />
        )}
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 toast-modern text-white text-center py-3 px-6 z-50 text-sm font-medium">{toast}</div>
      )}
      {master && (
        <BarcodeScannerModal
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          storeName={activeStore}
          storeShortName={master.storeShortNames[activeStore] || activeStore}
          lossDate={lossDate}
          barcodeToProduct={barcodeMap}
          onOptimisticLoss={onOptimisticLossScan}
        />
      )}
      {busy && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center shadow-xl">
            <div className="w-10 h-10 border-[3px] border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
            <p className="mt-3 font-semibold text-slate-700">処理中...</p>
          </div>
        </div>
      )}
    </div>
  );
}
