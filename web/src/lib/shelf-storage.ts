export const SHELF_ROWS = 4;
export const SHELF_COLS = 12;

export type ShelfCell = {
  productName: string | null;
  afterSale: number;
  afterMaintenance: number;
  photoUrl: string;
};

export type ShelfGrid = ShelfCell[][];

function emptyCell(): ShelfCell {
  return { productName: null, afterSale: 0, afterMaintenance: 0, photoUrl: '' };
}

export function createEmptyGrid(): ShelfGrid {
  return Array.from({ length: SHELF_ROWS }, () =>
    Array.from({ length: SHELF_COLS }, () => emptyCell())
  );
}

function key(store: string) {
  return `kirindo-shelf-v1:${store}`;
}

export function loadShelfGrid(store: string): ShelfGrid {
  if (typeof window === 'undefined') return createEmptyGrid();
  try {
    const raw = localStorage.getItem(key(store));
    if (!raw) return createEmptyGrid();
    const parsed = JSON.parse(raw) as ShelfGrid;
    if (!Array.isArray(parsed) || parsed.length !== SHELF_ROWS) return createEmptyGrid();
    return parsed;
  } catch {
    return createEmptyGrid();
  }
}

export function saveShelfGrid(store: string, grid: ShelfGrid) {
  localStorage.setItem(key(store), JSON.stringify(grid));
}

export type ProductMetrics = {
  cost: number;
  price: number;
  tenantFeePct: number;
};

const METRICS_KEY = 'kirindo-sales-metrics-v1';

export function loadProductMetrics(): Record<string, ProductMetrics> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(METRICS_KEY) || '{}');
  } catch {
    return {};
  }
}

export function saveProductMetrics(data: Record<string, ProductMetrics>) {
  localStorage.setItem(METRICS_KEY, JSON.stringify(data));
}

export function calcDeviation(display: number, sales: number): number {
  if (display <= 0) return sales > 0 ? 100 : 0;
  return Math.round(((sales - display) / display) * 1000) / 10;
}
