import { createAdminClient } from '@/lib/supabase/admin';
import { useLocalDevMode } from '@/lib/env';
import {
  buildSnapshotSummary,
  listItemFromRow,
  type OrderSnapshot,
  type OrderLogListItem,
  type StoredLogRow,
} from '@/lib/order-snapshot';
import { randomUUID } from 'crypto';

/** ローカル開発（サーバー）用インメモリログ */
let serverDevLogs: StoredLogRow[] = [];

function pushServerDevLog(row: StoredLogRow) {
  serverDevLogs = [row, ...serverDevLogs].slice(0, 200);
}

export async function saveOrderLog(
  snapshot: OrderSnapshot,
  isTest: boolean,
  savedCount: number
): Promise<{ id: string }> {
  const summary = buildSnapshotSummary(snapshot, isTest);
  const id = randomUUID();
  const row: StoredLogRow = {
    id,
    created_at: new Date().toISOString(),
    is_test: isTest,
    summary,
    snapshot,
    saved_count: savedCount,
  };

  if (useLocalDevMode()) {
    pushServerDevLog(row);
    return { id };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('order_operation_logs')
    .insert({
      is_test: isTest,
      summary,
      snapshot,
      saved_count: savedCount,
    })
    .select('id')
    .single();

  if (error) throw error;
  return { id: data.id };
}

export async function saveTestOrderPayload(
  operationLogId: string,
  snapshot: OrderSnapshot,
  items: OrderSnapshot['results']
): Promise<void> {
  if (useLocalDevMode()) return;

  const supabase = createAdminClient();
  const { error } = await supabase.from('test_order_logs').insert({
    operation_log_id: operationLogId,
    delivery_date: snapshot.deliveryDate,
    order_date: snapshot.orderDate,
    payload: { weather: snapshot.weather, items, storeState: snapshot.storeState },
  });
  if (error) throw error;
}

export async function listOrderLogs(limit = 100): Promise<OrderLogListItem[]> {
  if (useLocalDevMode()) {
    return serverDevLogs.slice(0, limit).map(listItemFromRow);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('order_operation_logs')
    .select('id, created_at, is_test, summary, saved_count, snapshot')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((row) => {
    const snap = row.snapshot as OrderSnapshot;
    return {
      id: row.id,
      createdAt: row.created_at,
      isTest: row.is_test,
      summary: row.summary,
      savedCount: row.saved_count,
      orderDate: snap?.orderDate || '',
      deliveryDate: snap?.deliveryDate || '',
      weather: snap?.weather || '',
    };
  });
}

export async function getOrderLogSnapshot(id: string): Promise<OrderSnapshot | null> {
  if (useLocalDevMode()) {
    return serverDevLogs.find((r) => r.id === id)?.snapshot || null;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('order_operation_logs')
    .select('snapshot')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return (data?.snapshot as OrderSnapshot) || null;
}
