'use client';

import { useCallback, useEffect, useState } from 'react';
import type { OrderLogListItem } from '@/lib/order-snapshot';
import type { OrderSnapshot } from '@/lib/order-snapshot';
import { shortDate } from '@/lib/dates';

interface Props {
  onRestore: (snapshot: OrderSnapshot) => void;
  onToast: (msg: string) => void;
}

export default function OrderLogPanel({ onRestore, onToast }: Props) {
  const [logs, setLogs] = useState<OrderLogListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/order-logs').then((r) => r.json());
      if (res.success) setLogs(res.logs || []);
      else onToast(res.message);
    } catch {
      onToast('操作ログの読込に失敗しました');
    }
    setLoading(false);
  }, [onToast]);

  useEffect(() => {
    load();
  }, [load]);

  const restore = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/order-logs?id=${encodeURIComponent(id)}`).then((r) => r.json());
      if (!res.success || !res.snapshot) {
        onToast(res.message || '復元に失敗しました');
        return;
      }
      onRestore(res.snapshot as OrderSnapshot);
      onToast('✓ 入力内容を復元しました');
    } catch {
      onToast('復元に失敗しました');
    }
    setBusyId('');
  };

  return (
    <div className="order-log-panel">
      <div className="order-log-header">
        <div>
          <h2 className="order-log-title">発注操作ログ</h2>
          <p className="order-log-sub">確定時の日付・天候・ロス入力・発注数をスナップショット保存。任意の時点に復元できます。</p>
        </div>
        <button type="button" className="calendar-action-btn calendar-action-btn--secondary" onClick={load} disabled={loading}>
          更新
        </button>
      </div>

      {loading && <p className="order-log-empty">読込中…</p>}

      {!loading && !logs.length && (
        <p className="order-log-empty">操作ログはまだありません。確認画面で「確定保存」すると記録されます。</p>
      )}

      <ul className="order-log-list">
        {logs.map((log) => (
          <li key={log.id} className={`order-log-item ${log.isTest ? 'order-log-item--test' : ''}`}>
            <div className="order-log-item-main">
              <div className="order-log-item-head">
                <time className="order-log-time">
                  {new Date(log.createdAt).toLocaleString('ja-JP', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
                {log.isTest && <span className="order-log-test-badge">テスト</span>}
              </div>
              <p className="order-log-summary">{log.summary}</p>
              <p className="order-log-meta">
                発注 {shortDate(log.orderDate)} → 納品 {shortDate(log.deliveryDate)} · {log.weather} · {log.savedCount}品目
              </p>
            </div>
            <button
              type="button"
              className="order-log-restore"
              disabled={busyId === log.id}
              onClick={() => restore(log.id)}
            >
              {busyId === log.id ? '復元中…' : 'この時点の入力内容を復元'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
