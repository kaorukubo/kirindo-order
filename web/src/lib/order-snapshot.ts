import type { CalcItem } from '@/types';

export interface OrderSnapshot {
  orderDate: string;
  salesDate: string;
  lossDate: string;
  weather: string;
  deliveryDate: string;
  storeOrder: string[];
  storeState: Record<string, Record<string, { sales: number; loss: number }>>;
  results: CalcItem[];
}

export interface OrderLogListItem {
  id: string;
  createdAt: string;
  isTest: boolean;
  summary: string;
  savedCount: number;
  orderDate: string;
  deliveryDate: string;
  weather: string;
}

export function buildSnapshotSummary(snapshot: OrderSnapshot, isTest: boolean): string {
  const units = snapshot.results.reduce((a, r) => a + r.totalUnits, 0);
  const prefix = isTest ? '[テスト] ' : '';
  return `${prefix}発注${snapshot.orderDate} → 納品${snapshot.deliveryDate} · ${snapshot.weather} · ${units}個`;
}

export function injectTestLossData(
  storeState: Record<string, Record<string, { sales: number; loss: number }>>,
  storeOrder: string[],
  storeProducts: Record<string, { name: string }[]>,
  maxLoss = 5
): Record<string, Record<string, { sales: number; loss: number }>> {
  const next: typeof storeState = {};
  for (const store of storeOrder) {
    next[store] = {};
    for (const p of storeProducts[store] || []) {
      const prev = storeState[store]?.[p.name] || { sales: 0, loss: 0 };
      next[store][p.name] = {
        sales: prev.sales,
        loss: Math.floor(Math.random() * (maxLoss + 1)),
      };
    }
  }
  return next;
}

const LOCAL_LOG_KEY = 'kirindo-order-logs-v1';

export interface StoredLogRow {
  id: string;
  created_at: string;
  is_test: boolean;
  summary: string;
  snapshot: OrderSnapshot;
  saved_count: number;
}

export function readLocalLogs(): StoredLogRow[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(LOCAL_LOG_KEY) || '[]') as StoredLogRow[];
  } catch {
    return [];
  }
}

export function writeLocalLogs(rows: StoredLogRow[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_LOG_KEY, JSON.stringify(rows.slice(0, 200)));
}

export function appendLocalLog(row: StoredLogRow) {
  const rows = readLocalLogs();
  rows.unshift(row);
  writeLocalLogs(rows);
}

export function getLocalLog(id: string): StoredLogRow | null {
  return readLocalLogs().find((r) => r.id === id) || null;
}

export function listItemFromRow(row: StoredLogRow): OrderLogListItem {
  return {
    id: row.id,
    createdAt: row.created_at,
    isTest: row.is_test,
    summary: row.summary,
    savedCount: row.saved_count,
    orderDate: row.snapshot.orderDate,
    deliveryDate: row.snapshot.deliveryDate,
    weather: row.snapshot.weather,
  };
}
