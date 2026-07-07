import type { CalcItem, MasterData } from '@/types';

export function getCoef(
  coefficientMap: MasterData['coefficientMap'],
  dayName: string,
  weather: string
): number {
  return Number(coefficientMap[dayName]?.[weather]) || 1;
}

export function splitInt(total: number, weights: number[]): number[] {
  const wSum = weights.reduce((a, b) => a + b, 0);
  if (wSum <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (w / wSum) * total);
  const floors = exact.map((v) => Math.floor(v));
  let rem = total - floors.reduce((a, b) => a + b, 0);
  const fr = exact.map((v, i) => ({ i, f: v - floors[i] })).sort((a, b) => b.f - a.f);
  const r = floors.slice();
  for (let j = 0; j < rem; j++) r[fr[j % fr.length].i]++;
  return r;
}

export function distribute(
  master: MasterData,
  productName: string,
  needs: number[],
  totalUnits: number
): number[] {
  if (totalUnits <= 0) return needs.map(() => 0);
  const ratios = master.salesRatio[productName];
  let weights: number[];
  if (ratios && Object.keys(ratios).length) {
    weights = master.storeOrder.map((s) => Number(ratios[s]) || 0);
  } else {
    weights = needs.slice();
  }
  let wSum = weights.reduce((a, b) => a + b, 0);
  if (wSum <= 0) {
    weights = needs.slice();
    wSum = weights.reduce((a, b) => a + b, 0);
  }
  if (wSum <= 0) {
    const b = Math.floor(totalUnits / master.storeOrder.length);
    const a = weights.map(() => b);
    for (let i = 0; i < totalUnits - b * a.length; i++) a[i % a.length]++;
    return a;
  }
  return splitInt(totalUnits, weights);
}

export function calcProduct(
  master: MasterData,
  productName: string,
  orderUnit: number,
  losses: number[],
  sales: number[],
  dayName: string,
  weather: string
): CalcItem {
  const coef = getCoef(master.coefficientMap, dayName, weather);
  const smap = master.storeProductMap[productName] || {};
  const needs = master.storeOrder.map((s, i) => {
    const base = Number(smap[s]) || 0;
    return Math.max(0, Math.ceil(base * coef) - (Number(losses[i]) || 0));
  });
  const totalNeed = needs.reduce((a, b) => a + b, 0);
  let totalUnits = 0;
  let cases = 0;
  let remainder = 0;
  if (totalNeed > 0) {
    cases = Math.floor(totalNeed / orderUnit);
    remainder = totalNeed % orderUnit;
    if (remainder > 0) {
      cases++;
      remainder = 0;
    }
    totalUnits = cases * orderUnit;
  }
  const allocations = distribute(master, productName, needs, totalUnits);
  return {
    productName,
    orderUnit,
    coefficient: coef,
    needs,
    totalUnits,
    cases,
    remainder,
    allocations,
    losses,
    sales,
  };
}

export function calcAllProducts(
  master: MasterData,
  storeState: Record<string, Record<string, { sales: number; loss: number }>>,
  dayName: string,
  weather: string
): CalcItem[] {
  return master.products.map((p) => {
    const losses: number[] = [];
    const sales: number[] = [];
    master.storeOrder.forEach((s) => {
      const st = storeState[s]?.[p.name] || { sales: 0, loss: 0 };
      sales.push(st.sales || 0);
      losses.push(st.loss || 0);
    });
    return calcProduct(master, p.name, p.orderUnit, losses, sales, dayName, weather);
  });
}
