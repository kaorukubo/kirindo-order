'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MasterData } from '@/types';
import LabelPreview from '@/components/LabelPreview';
import {
  LABEL_FIELD_KEYS,
  LABEL_FIELD_LABELS,
  defaultLabelInfo,
  type LabelTemplate,
  type ProductLabelInfo,
  type WeeklyLabelItem,
} from '@/lib/label-types';

interface Props {
  master: MasterData;
  onLabelsIssued: (labels: WeeklyLabelItem[]) => void;
  onToast: (msg: string) => void;
  onImportCsv: (files: FileList | null) => void;
  importProgress: string;
}

export default function LabelPanel({ master, onLabelsIssued, onToast, onImportCsv, importProgress }: Props) {
  const [labels, setLabels] = useState<WeeklyLabelItem[]>(master.weeklyLabels || []);
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [selectedKey, setSelectedKey] = useState('');
  const [labelInfoMap, setLabelInfoMap] = useState<Record<string, ProductLabelInfo>>({});
  const [draft, setDraft] = useState<ProductLabelInfo | null>(null);
  const [template, setTemplate] = useState<LabelTemplate>('standard');
  const [busy, setBusy] = useState(false);
  const [showPrint, setShowPrint] = useState(false);

  const productNames = useMemo(
    () => [...new Set(labels.map((l) => l.productName))].sort((a, b) => a.localeCompare(b, 'ja')),
    [labels]
  );

  const loadLabels = useCallback(async () => {
    const res = await fetch(`/api/labels?weekStart=${master.weekStart}`).then((r) => r.json());
    if (res.success) {
      setLabels(res.labels || []);
      setPeriodFrom(res.periodFrom || '');
      setPeriodTo(res.periodTo || '');
      onLabelsIssued(res.labels || []);
    }
  }, [master.weekStart, onLabelsIssued]);

  const loadLabelInfo = useCallback(async (names: string[]) => {
    if (!names.length) return;
    const res = await fetch(`/api/label-info?products=${encodeURIComponent(names.join(','))}`).then((r) => r.json());
    if (res.success) setLabelInfoMap((prev) => ({ ...prev, ...res.labels }));
  }, []);

  useEffect(() => {
    loadLabels();
  }, [loadLabels]);

  useEffect(() => {
    if (productNames.length) loadLabelInfo(productNames);
  }, [productNames, loadLabelInfo]);

  const filtered = useMemo(() => {
    if (storeFilter === 'all') return labels;
    return labels.filter((l) => l.storeName === storeFilter);
  }, [labels, storeFilter]);

  const listItems = useMemo(() => {
    return [...filtered].sort((a, b) => b.count - a.count || a.productName.localeCompare(b.productName, 'ja'));
  }, [filtered]);

  const selectedItem = listItems.find((l) => `${l.storeName}::${l.productName}` === selectedKey) || listItems[0];

  useEffect(() => {
    if (!selectedItem) {
      setDraft(null);
      return;
    }
    const key = `${selectedItem.storeName}::${selectedItem.productName}`;
    if (selectedKey !== key) setSelectedKey(key);
    const info = labelInfoMap[selectedItem.productName] || defaultLabelInfo(selectedItem.productName);
    setDraft({ ...info, productName: selectedItem.productName });
  }, [selectedItem, labelInfoMap, selectedKey]);

  const issueLabels = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart: master.weekStart }),
      }).then((r) => r.json());
      if (res.success) {
        setLabels(res.labels || []);
        setPeriodFrom(res.periodFrom || '');
        setPeriodTo(res.periodTo || '');
        onLabelsIssued(res.labels || []);
        onToast(`✓ ${res.message}`);
        const names = [...new Set((res.labels || []).map((l: WeeklyLabelItem) => l.productName))] as string[];
        await loadLabelInfo(names);
      } else {
        onToast(res.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const res = await fetch('/api/label-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      }).then((r) => r.json());
      onToast(res.success ? '✓ ラベル情報を保存しました' : res.message);
      if (res.success) {
        setLabelInfoMap((prev) => ({ ...prev, [draft.productName]: draft }));
      }
    } finally {
      setBusy(false);
    }
  };

  const printLabels = useMemo(() => {
    const out: { info: ProductLabelInfo; storeName: string; copies: number }[] = [];
    for (const item of filtered) {
      const info = labelInfoMap[item.productName] || defaultLabelInfo(item.productName);
      for (let i = 0; i < item.count; i++) {
        out.push({ info, storeName: item.storeName, copies: 1 });
      }
    }
    return out;
  }, [filtered, labelInfoMap]);

  const onPrint = () => {
    if (!printLabels.length) {
      onToast('発行済みラベルがありません。先に「前週実績から発行」を実行してください');
      return;
    }
    setShowPrint(true);
    setTimeout(() => {
      window.print();
      setShowPrint(false);
    }, 300);
  };

  const updateDraft = (patch: Partial<ProductLabelInfo>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };

  const toggleVisibility = (key: keyof ProductLabelInfo['visibility']) => {
    setDraft((d) => (d ? { ...d, visibility: { ...d.visibility, [key]: !d.visibility[key] } } : d));
  };

  return (
    <>
      <div className="label-panel">
        <div className="label-panel-toolbar">
          <div>
            <h2 className="label-panel-title">週次ラベル発行</h2>
            <p className="label-panel-sub">
              前週（{periodFrom && periodTo ? `${periodFrom} 〜 ${periodTo}` : '未発行'}）の販売実績＝印刷枚数
            </p>
          </div>
          <div className="label-panel-actions">
            <select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} className="label-select">
              <option value="all">全店舗</option>
              {master.storeOrder.map((s) => (
                <option key={s} value={s}>{master.storeShortNames[s] || s}</option>
              ))}
            </select>
            <select value={template} onChange={(e) => setTemplate(e.target.value as LabelTemplate)} className="label-select">
              <option value="standard">標準レイアウト</option>
              <option value="compact">コンパクト</option>
            </select>
            <button type="button" className="calendar-action-btn calendar-action-btn--secondary" onClick={issueLabels} disabled={busy}>
              前週実績から発行
            </button>
            <button type="button" className="calendar-action-btn calendar-action-btn--apply" onClick={onPrint} disabled={busy || !printLabels.length}>
              印刷 ({printLabels.length}枚)
            </button>
          </div>
        </div>

        <div className="label-panel-body">
          <div className="label-list-col">
            <p className="label-col-title">発行リスト（{listItems.length}件）</p>
            <div className="label-list-scroll">
              {listItems.map((item) => {
                const key = `${item.storeName}::${item.productName}`;
                const info = labelInfoMap[item.productName];
                const ready = info?.barcode && info?.unitPrice != null;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`label-list-item ${selectedKey === key ? 'active' : ''}`}
                    onClick={() => setSelectedKey(key)}
                  >
                    <div>
                      <p className="label-list-name">{item.productName}</p>
                      <p className="label-list-store">{master.storeShortNames[item.storeName] || item.storeName}</p>
                    </div>
                    <div className="label-list-meta">
                      <span className="label-list-count">{item.count}枚</span>
                      {!ready && <span className="label-list-warn">要設定</span>}
                    </div>
                  </button>
                );
              })}
              {!listItems.length && (
                <p className="label-empty">「前週実績から発行」を実行してください。販売CSVの取込が必要です。</p>
              )}
            </div>

            <div className="label-import-box">
              <p className="text-xs font-bold text-slate-600">販売CSV取込</p>
              <input type="file" accept=".csv" multiple onChange={(e) => onImportCsv(e.target.files)} className="mt-1 w-full text-xs" />
              {importProgress && <p className="text-xs text-blue-700 mt-1">{importProgress}</p>}
            </div>
          </div>

          <div className="label-edit-col">
            {draft ? (
              <>
                <p className="label-col-title">ラベル内容 — {draft.productName}</p>
                <div className="label-edit-grid">
                  <label className="label-edit-field">
                    <span>売価（税込・円）</span>
                    <input type="number" min="0" value={draft.unitPrice ?? ''} onChange={(e) => updateDraft({ unitPrice: e.target.value ? Number(e.target.value) : null })} />
                  </label>
                  <label className="label-edit-field">
                    <span>バーコード（JAN等）</span>
                    <input value={draft.barcode} onChange={(e) => updateDraft({ barcode: e.target.value })} placeholder="4901234567890" />
                  </label>
                  <label className="label-edit-field">
                    <span>販売者</span>
                    <input value={draft.seller} onChange={(e) => updateDraft({ seller: e.target.value })} />
                  </label>
                  <label className="label-edit-field">
                    <span>加工者</span>
                    <input value={draft.processor} onChange={(e) => updateDraft({ processor: e.target.value })} />
                  </label>
                  <label className="label-edit-field">
                    <span>原産地</span>
                    <input value={draft.origin} onChange={(e) => updateDraft({ origin: e.target.value })} />
                  </label>
                  <label className="label-edit-field">
                    <span>内容量</span>
                    <input value={draft.netWeight} onChange={(e) => updateDraft({ netWeight: e.target.value })} />
                  </label>
                  <label className="label-edit-field label-edit-field--wide">
                    <span>保存方法</span>
                    <input value={draft.storageMethod} onChange={(e) => updateDraft({ storageMethod: e.target.value })} />
                  </label>
                  <label className="label-edit-field label-edit-field--wide">
                    <span>原材料名</span>
                    <input value={draft.ingredients} onChange={(e) => updateDraft({ ingredients: e.target.value })} />
                  </label>
                </div>

                <div className="label-visibility">
                  <p className="label-visibility-title">表示項目</p>
                  <div className="label-visibility-grid">
                    {LABEL_FIELD_KEYS.map((key) => (
                      <label key={key} className="label-visibility-item">
                        <input type="checkbox" checked={draft.visibility[key]} onChange={() => toggleVisibility(key)} />
                        {LABEL_FIELD_LABELS[key]}
                      </label>
                    ))}
                  </div>
                </div>

                <button type="button" className="calendar-action-btn" onClick={saveDraft} disabled={busy}>
                  この商品のラベル情報を保存
                </button>
              </>
            ) : (
              <p className="label-empty">左のリストから商品を選択してください</p>
            )}
          </div>

          <div className="label-preview-col">
            <p className="label-col-title">プレビュー</p>
            {draft && selectedItem ? (
              <LabelPreview info={draft} storeName={selectedItem.storeName} template={template} />
            ) : (
              <div className="label-preview label-preview--empty">プレビュー</div>
            )}
            <p className="label-preview-hint">同一商品は全店舗で共通のラベル内容。枚数のみ店舗ごとに異なります。</p>
          </div>
        </div>
      </div>

      {showPrint && (
        <div className="label-print-root">
          {printLabels.map((item, i) => (
            <LabelPreview key={i} info={item.info} storeName={item.storeName} template={template} />
          ))}
        </div>
      )}
    </>
  );
}
