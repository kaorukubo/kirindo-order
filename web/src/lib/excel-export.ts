import * as XLSX from 'xlsx';
import type { CalcItem } from '@/types';
import { addDays, dayName, shortDate } from '@/lib/dates';

export function buildPrintRows(
  items: CalcItem[],
  storeOrder: string[],
  storeShortNames: Record<string, string>,
  orderDate: string,
  deliveryDate: string,
  weather: string
): unknown[][] {
  const arrivalDate = addDays(orderDate, 1);
  const dnDelivery = dayName(deliveryDate);
  const dnArrival = dayName(arrivalDate);
  const filtered = items.filter((it) => it.totalUnits > 0);

  const rows: unknown[][] = [
    ['畑光　様', '', '', '', '', '', '', '', '', 'Isaten Foods株式会社', ''],
    ['', '', '', '', '', '', '', '', '', '〒652-0832 神戸市兵庫区鍛冶屋町2-1-2', ''],
    [
      '引取日', `${shortDate(deliveryDate)} (${dnDelivery})`, '', '到着日',
      `${shortDate(arrivalDate)} (${dnArrival})`, '', '発注日', orderDate, '天候', weather,
    ],
    ['', 'キリン堂用 青果 発注・分荷表', '', '', '納品日', `${deliveryDate} (${dnDelivery})`, '', '', '', 'TEL 078-219-3411', ''],
    [],
    ['【発注一覧（畑光様）】'],
    ['No', '商品名', '発注数', 'ケース'],
  ];

  filtered.forEach((it, i) => {
    rows.push([i + 1, it.productName, it.totalUnits, it.cases]);
  });
  const totalUnits = filtered.reduce((a, it) => a + it.totalUnits, 0);
  const totalCases = filtered.reduce((a, it) => a + it.cases, 0);
  rows.push(['', '合計', totalUnits, totalCases], []);

  rows.push(['【店舗別振分】']);
  rows.push(['商品名', '合計', ...storeOrder.map((s) => storeShortNames[s] || s)]);

  filtered.forEach((it) => {
    rows.push([it.productName, it.totalUnits, ...it.allocations]);
  });
  const storeTotals = storeOrder.map((_, si) =>
    filtered.reduce((a, it) => a + (it.allocations[si] || 0), 0)
  );
  rows.push(['合計', totalUnits, ...storeTotals]);

  return rows;
}

export function downloadOrderExcel(
  items: CalcItem[],
  storeOrder: string[],
  storeShortNames: Record<string, string>,
  orderDate: string,
  deliveryDate: string,
  weather: string
) {
  const rows = buildPrintRows(items, storeOrder, storeShortNames, orderDate, deliveryDate, weather);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 5 }, { wch: 24 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
    { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 28 }, { wch: 8 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '発注書');
  const fname = `畑光発注書_分荷表_${orderDate.replace(/-/g, '')}.xlsx`;
  XLSX.writeFile(wb, fname);
}
