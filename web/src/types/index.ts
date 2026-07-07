export const DELIVERY_LEAD_DAYS = 2;
export const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'] as const;
export type DayName = (typeof DAY_NAMES)[number];
export type Weather = '晴れ' | '曇り' | '雨';

export interface Store {
  id: string;
  name: string;
  code: string;
  short_name: string;
  sort_order: number;
}

export interface Product {
  id: string;
  name: string;
  order_unit: number;
}

export interface StoreProduct {
  name: string;
  orderUnit: number;
  baseDisplay: number;
}

export interface MasterData {
  products: { name: string; orderUnit: number }[];
  storeOrder: string[];
  storeShortNames: Record<string, string>;
  storeProducts: Record<string, StoreProduct[]>;
  storeProductMap: Record<string, Record<string, number>>;
  coefficientMap: Record<string, Record<string, number>>;
  weatherOptions: string[];
  weatherCoefficients: Record<string, number>;
  dayCoefficients: Record<string, number>;
  salesRatio: Record<string, Record<string, number>>;
  weekStart: string;
  weeklyLabels: { storeName: string; productName: string; count: number }[];
  deliveryLeadDays: number;
  salesDateDefault: string;
  lossDateDefault: string;
}

export interface CalcItem {
  productName: string;
  orderUnit: number;
  coefficient: number;
  needs: number[];
  totalUnits: number;
  cases: number;
  remainder: number;
  allocations: number[];
  losses: number[];
  sales: number[];
}

export interface SaveOrderPayload {
  targetDate: string;
  orderDate: string;
  weather: string;
  storeOrder: string[];
  items: CalcItem[];
}

export interface StoreInputData {
  salesDate: string;
  lossDate: string;
  sales: Record<string, Record<string, number>>;
  losses: Record<string, Record<string, number>>;
}
