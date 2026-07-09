import realMaster from '@/data/real-master.json';
import { addDays, getWeekStart } from '@/lib/dates';
import { buildCoefficientMap, DEFAULT_DAY_COEF, DEFAULT_WEATHER_COEF } from '@/lib/coefficients';
import { mergeHatakoFlags, readLocalHatakoFlags } from '@/lib/hatako-order';

export function fetchMasterFromLocalJson() {
  const storeOrder = realMaster.STORES.map((s) => s.name);
  const storeShortNames = Object.fromEntries(realMaster.STORES.map((s) => [s.name, s.short]));
  const storeProductsMap: Record<string, { name: string; orderUnit: number; baseDisplay: number }[]> = {};
  const storeProductMap: Record<string, Record<string, number>> = {};

  for (const s of realMaster.STORES) {
    storeProductsMap[s.name] = [];
  }

  for (const row of realMaster.storeProducts) {
    const storeName = String(row[0]);
    const productName = String(row[1]);
    const baseDisplay = Number(row[2]) || 0;
    const orderUnit = Number(realMaster.productRows.find(([n]) => n === productName)?.[1]) || 1;
    if (!storeProductMap[productName]) storeProductMap[productName] = {};
    storeProductMap[productName][storeName] = baseDisplay;
    storeProductsMap[storeName].push({ name: productName, orderUnit, baseDisplay });
  }

  const coef = { day: { ...DEFAULT_DAY_COEF }, weather: { ...DEFAULT_WEATHER_COEF } };
  const today = new Date().toISOString().slice(0, 10);

  const productNames = realMaster.productRows.map(([name]) => String(name));
  const localFlags = typeof window !== 'undefined' ? readLocalHatakoFlags() : {};
  const hatakoOrderSheet = mergeHatakoFlags(productNames, {}, localFlags);

  return {
    success: true,
    localDev: true,
    products: realMaster.productRows.map(([name, orderUnit]) => ({
      name: String(name),
      orderUnit: Number(orderUnit) || 1,
      hatakoOrderSheet: hatakoOrderSheet[String(name)] !== false,
    })),
    storeOrder,
    storeShortNames,
    storeProducts: storeProductsMap,
    storeProductMap,
    hatakoOrderSheet,
    coefficientMap: buildCoefficientMap(coef),
    weatherOptions: Object.keys(DEFAULT_WEATHER_COEF),
    weatherCoefficients: coef.weather,
    dayCoefficients: coef.day,
    salesRatio: {} as Record<string, Record<string, number>>,
    weekStart: getWeekStart(),
    weeklyLabels: [] as { storeName: string; productName: string; count: number }[],
    deliveryLeadDays: 2,
    salesDateDefault: addDays(today, -1),
    lossDateDefault: addDays(today, 1),
  };
}

export function emptyStoreInput(storeOrder: string[], productNames: string[]) {
  const sales: Record<string, Record<string, number>> = {};
  const losses: Record<string, Record<string, number>> = {};
  for (const store of storeOrder) {
    sales[store] = {};
    losses[store] = {};
    for (const p of productNames) {
      sales[store][p] = 0;
      losses[store][p] = 0;
    }
  }
  return { sales, losses };
}
