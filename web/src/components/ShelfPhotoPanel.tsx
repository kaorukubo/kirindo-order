'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MasterData } from '@/types';
import { compressImageFile } from '@/lib/image-compress';
import { getStaffName } from '@/lib/staff-session';
import type { ShelfPhotoPhase } from '@/lib/shelf-photos';

interface PhotoItem {
  id: string;
  storeName: string;
  phase: ShelfPhotoPhase;
  staffName: string;
  imagePath: string;
  takenAt: string;
}

interface Props {
  master: MasterData;
  activeStore: string;
  onStoreChange: (store: string) => void;
  onToast: (msg: string) => void;
}

const PHASE_LABEL: Record<ShelfPhotoPhase, string> = {
  before: '陳列前',
  after: '陳列後',
};

export default function ShelfPhotoPanel({ master, activeStore, onStoreChange, onToast }: Props) {
  const [phase, setPhase] = useState<ShelfPhotoPhase>('before');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<PhotoItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/shelf-photos?store=${encodeURIComponent(activeStore)}`).then((r) => r.json());
      if (res.success) setPhotos(res.photos || []);
    } catch {
      onToast('写真の読込に失敗しました');
    }
    setLoading(false);
  }, [activeStore, onToast]);

  useEffect(() => {
    load();
  }, [load]);

  const onCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const imagePath = await compressImageFile(file);
      const res = await fetch('/api/shelf-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName: activeStore,
          phase,
          staffName: getStaffName(),
          imagePath,
        }),
      }).then((r) => r.json());
      if (res.success) {
        onToast(`✓ ${PHASE_LABEL[phase]}の写真を保存しました`);
        await load();
      } else {
        onToast(res.message);
      }
    } catch {
      onToast('写真の保存に失敗しました');
    }
    setUploading(false);
  };

  const remove = async (id: string) => {
    if (!confirm('この写真を削除しますか？')) return;
    const res = await fetch(`/api/shelf-photos?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).then((r) => r.json());
    if (res.success) {
      setPhotos((p) => p.filter((x) => x.id !== id));
      setPreview(null);
      onToast('削除しました');
    }
  };

  return (
    <div className="mobile-panel shelf-photo-panel">
      <header className="mobile-panel-head">
        <h2 className="mobile-panel-title">棚写真</h2>
        <p className="mobile-panel-sub">店舗ごとに陳列前・陳列後を撮影して保存</p>
      </header>

      <div className="segment-control px-3 pb-2">
        {master.storeOrder.map((store) => (
          <button
            key={store}
            type="button"
            className={`segment-btn ${store === activeStore ? 'active' : ''}`}
            onClick={() => onStoreChange(store)}
          >
            {master.storeShortNames[store] || store}
          </button>
        ))}
      </div>

      <div className="shelf-photo-phase">
        {(['before', 'after'] as ShelfPhotoPhase[]).map((p) => (
          <button
            key={p}
            type="button"
            className={`shelf-photo-phase-btn ${phase === p ? 'active' : ''}`}
            onClick={() => setPhase(p)}
          >
            {PHASE_LABEL[p]}
          </button>
        ))}
      </div>

      <div className="shelf-photo-actions">
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onCapture} />
        <button
          type="button"
          className="shelf-photo-capture-btn"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? '保存中…' : `📷 ${PHASE_LABEL[phase]}を撮影`}
        </button>
      </div>

      {loading && <p className="mobile-empty">読込中…</p>}

      <div className="shelf-photo-grid">
        {photos.map((p) => (
          <button key={p.id} type="button" className="shelf-photo-thumb" onClick={() => setPreview(p)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.imagePath} alt={p.phase} />
            <span className={`shelf-photo-badge shelf-photo-badge--${p.phase}`}>{PHASE_LABEL[p.phase]}</span>
            <span className="shelf-photo-date">
              {new Date(p.takenAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </button>
        ))}
        {!loading && !photos.length && <p className="mobile-empty col-span-full">写真はまだありません</p>}
      </div>

      {preview && (
        <div className="shelf-photo-modal" onClick={() => setPreview(null)}>
          <div className="shelf-photo-modal-inner" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.imagePath} alt="" className="shelf-photo-modal-img" />
            <div className="shelf-photo-modal-meta">
              <p>{master.storeShortNames[preview.storeName] || preview.storeName} · {PHASE_LABEL[preview.phase]}</p>
              <p>{preview.staffName || '担当未設定'} · {new Date(preview.takenAt).toLocaleString('ja-JP')}</p>
            </div>
            <button type="button" className="btn-delete-sm" onClick={() => remove(preview.id)}>削除</button>
            <button type="button" className="calendar-action-btn calendar-action-btn--secondary mt-2 w-full" onClick={() => setPreview(null)}>閉じる</button>
          </div>
        </div>
      )}
    </div>
  );
}
