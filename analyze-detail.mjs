import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const bunniFile = 'G:\\マイドライブ\\うおらぼ イサテン請求書\\キリン分荷表\\畑光発注書_分荷表_7-7(火)_CSV数量比率按分２２.xlsx';
const labelFile = 'G:\\マイドライブ\\うおらぼ イサテン請求書\\キリン分荷表\\畑光ラベル印刷1週間出荷数量.xlsx';
const salesFile = 'G:\\マイドライブ\\うおらぼ イサテン請求書\\売上元データ\\CSV_260707_101024.csv';

function dumpSheet(file, sheetName, maxRows = 50) {
  const wb = XLSX.readFile(file, { cellDates: true });
  const ws = wb.Sheets[sheetName || wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  // find rows with product-like data
  const interesting = [];
  for (let i = 0; i < Math.min(data.length, maxRows); i++) {
    const row = data[i];
    const joined = row.map(c => String(c)).join('|');
    if (/店|品|数量|レタス|人参|西|鈴|振|分|合計|引取/.test(joined)) {
      interesting.push({ row: i + 1, cells: row.filter(c => c !== '').slice(0, 20) });
    }
  }
  return { sheet: sheetName || wb.SheetNames[0], sheetNames: wb.SheetNames, interesting, totalRows: data.length };
}

// sales - read as buffer and detect
const buf = fs.readFileSync(salesFile);
let salesText = buf.toString('utf8');
if (salesText.includes('\uFFFD') || !salesText.includes('店舗')) {
  // try cp932 via TextDecoder not available - manual read from earlier known good
  salesText = fs.readFileSync(salesFile, 'latin1');
}
const firstLine = salesText.split(/\r?\n/)[0];
const lineCount = salesText.split(/\r?\n/).filter(Boolean).length;

console.log(JSON.stringify({
  salesPreview: {
    encoding: 'check',
    header: firstLine.slice(0, 200),
    lineCount,
    sampleLine2: salesText.split(/\r?\n/)[1]?.slice(0, 150),
  },
  bunni: dumpSheet(bunniFile, '発注書', 80),
  label: dumpSheet(labelFile, '1週間出荷数量リスト', 30),
}, null, 2));
