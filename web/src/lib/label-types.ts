export const LABEL_FIELD_KEYS = [
  'productName',
  'unitPrice',
  'barcode',
  'seller',
  'processor',
  'origin',
  'netWeight',
  'storageMethod',
  'ingredients',
] as const;

export type LabelFieldKey = (typeof LABEL_FIELD_KEYS)[number];

export const LABEL_FIELD_LABELS: Record<LabelFieldKey, string> = {
  productName: '商品名',
  unitPrice: '売価（税込）',
  barcode: 'バーコード',
  seller: '販売者',
  processor: '加工者',
  origin: '原産地',
  netWeight: '内容量',
  storageMethod: '保存方法',
  ingredients: '原材料名',
};

export type LabelTemplate = 'standard' | 'compact';

export interface LabelFieldVisibility {
  productName: boolean;
  unitPrice: boolean;
  barcode: boolean;
  seller: boolean;
  processor: boolean;
  origin: boolean;
  netWeight: boolean;
  storageMethod: boolean;
  ingredients: boolean;
}

export interface ProductLabelInfo {
  productName: string;
  unitPrice: number | null;
  barcode: string;
  seller: string;
  processor: string;
  origin: string;
  netWeight: string;
  storageMethod: string;
  ingredients: string;
  visibility: LabelFieldVisibility;
}

export interface WeeklyLabelItem {
  storeName: string;
  productName: string;
  count: number;
  periodFrom?: string;
  periodTo?: string;
}

export interface PrintableLabel extends ProductLabelInfo {
  storeName: string;
  copies: number;
  template: LabelTemplate;
}

export const DEFAULT_VISIBILITY: LabelFieldVisibility = {
  productName: true,
  unitPrice: true,
  barcode: true,
  seller: true,
  processor: true,
  origin: true,
  netWeight: false,
  storageMethod: false,
  ingredients: false,
};

export const DEFAULT_SELLER = 'イサタン食品株式会社';

export function defaultLabelInfo(productName: string): ProductLabelInfo {
  return {
    productName,
    unitPrice: null,
    barcode: '',
    seller: DEFAULT_SELLER,
    processor: '',
    origin: '',
    netWeight: '',
    storageMethod: '要冷蔵（10℃以下）',
    ingredients: '',
    visibility: { ...DEFAULT_VISIBILITY },
  };
}

export function mergeVisibility(raw?: Partial<LabelFieldVisibility>): LabelFieldVisibility {
  return { ...DEFAULT_VISIBILITY, ...(raw || {}) };
}

export function formatPriceYen(price: number | null): string {
  if (price == null || Number.isNaN(price)) return '—';
  return `¥${price.toLocaleString('ja-JP')}（税込）`;
}
