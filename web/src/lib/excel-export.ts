import * as XLSX from 'xlsx';
import type { CalcItem } from '@/types';
import { addDays, dayName, shortDate } from '@/lib/dates';
import { HATAKO_ORDER_SHEET_FILENAME_PREFIX, HATAKO_SUPPLIER_NAME, isHatakoOrderProduct } from '@/lib/hatako-order';

export interface OrderExcelOptions {
  hatakoOrderSheet?: Record<string, boolean>;
}

export function buildPrintRows(
  items: CalcItem[],
  storeOrder: string[],
  storeShortNames: Record<string, string>,
  orderDate: string,
  deliveryDate: string,
  weather: string,
  options: OrderExcelOptions = {}
): unknown[][] {
  const flags = options.hatakoOrderSheet || {};
  const arrivalDate = addDays(orderDate, 1);
  const dnDelivery = dayName(deliveryDate);
  const dnArrival = dayName(arrivalDate);
  const withQty = items.filter((it) => it.totalUnits > 0);
  const hatakoItems = withQty.filter((it) => isHatakoOrderProduct(it.productName, flags));
  const excludedCount = withQty.length - hatakoItems.length;

  const rows: unknown[][] = [
    [`${HATAKO_SUPPLIER_NAME}　様`, '', '', '', '', '', '', '', '', 'Isaten Foods株式会社', ''],
    ['', '', '', '', '', '', '', '', '', '〒652-0832 神戸市兵庫区鍛冶屋町2-1-2', ''],
    [
      '引取日', `${shortDate(deliveryDate)} (${dnDelivery})`, '', '到着日',
      `${shortDate(arrivalDate)} (${dnArrival})`, '', '発注日', orderDate, '天候', weather,
    ],
    ['', 'キリン堂用 青果 発注・分荷表', '', '', '納品日', `${deliveryDate} (${dnDelivery})`, '', '', '', 'TEL 078-219-3411', ''],
    [],
    [`【発注一覧（${HATAKO_SUPPLIER_NAME}様）】`],
    ['No', '商品名', '発注数', 'ケース'],
  ];

  hatakoItems.forEach((it, i) => {
    rows.push([i + 1, it.productName, it.totalUnits, it.cases]);
  });
  const hatakoUnits = hatakoItems.reduce((a, it) => a + it.totalUnits, 0);
  const hatakoCases = hatakoItems.reduce((a, it) => a + it.cases, 0);
  rows.push(['', '合計', hatakoUnits, hatakoCases]);
  if (excludedCount > 0) {
    rows.push(['', `※畑光発注対象外 ${excludedCount}品目は発注一覧から除外`, '', '']);
  }
  rows.push([]);

  rows.push(['【店舗別振分（全商品）】']);
  rows.push(['商品名', '合計', '畑光', ...storeOrder.map((s) => storeShortNames[s] || s)]);

  withQty.forEach((it) => {
    const onSheet = isHatakoOrderProduct(it.productName, flags);
    rows.push([it.productName, it.totalUnits, onSheet ? '○' : '—', ...it.allocations]);
  });
  const storeTotals = storeOrder.map((_, si) =>
    withQty.reduce((a, it) => a + (it.allocations[si] || 0), 0)
  );
  const totalUnits = withQty.reduce((a, it) => a + it.totalUnits, 0);
  rows.push(['合計', totalUnits, '', ...storeTotals]);

  return rows;
}

export function downloadOrderExcel(
  items: CalcItem[],
  storeOrder: string[],
  storeShortNames: Record<string, string>,
  orderDate: string,
  deliveryDate: string,
  weather: string,
  options: OrderExcelOptions = {}
) {
  const rows = buildPrintRows(items, storeOrder, storeShortNames, orderDate, deliveryDate, weather, options);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 5 }, { wch: 24 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
    { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 28 }, { wch: 8 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '発注書');
  const fname = `${HATAKO_ORDER_SHEET_FILENAME_PREFIX}_${orderDate.replace(/-/g, '')}.xlsx`;
  XLSX.writeFile(wb, fname);
}
