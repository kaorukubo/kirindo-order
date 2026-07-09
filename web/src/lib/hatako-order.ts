/** 発注先サプライヤー（畑光） */
export const HATAKO_SUPPLIER_NAME = '畑光';

export const HATAKO_ORDER_SHEET_FILENAME_PREFIX = '畑光発注書_分荷表';

/** 商品が畑光発注書の「発注一覧」に載るか（未設定は true） */
export function isHatakoOrderProduct(
  productName: string,
  flags: Record<string, boolean>
): boolean {
  return flags[productName] !== false;
}

export function countHatakoProducts(flags: Record<string, boolean>): number {
  return Object.values(flags).filter(Boolean).length;
}

const LOCAL_KEY = 'kirindo-hatako-order-v1';

export function readLocalHatakoFlags(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function writeLocalHatakoFlag(productName: string, enabled: boolean) {
  if (typeof window === 'undefined') return;
  const map = readLocalHatakoFlags();
  map[productName] = enabled;
  localStorage.setItem(LOCAL_KEY, JSON.stringify(map));
}

export function mergeHatakoFlags(
  productNames: string[],
  fromDb: Record<string, boolean>,
  local?: Record<string, boolean>
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  const loc = local || {};
  for (const name of productNames) {
    if (name in loc) out[name] = loc[name];
    else if (name in fromDb) out[name] = fromDb[name];
    else out[name] = true;
  }
  return out;
}
