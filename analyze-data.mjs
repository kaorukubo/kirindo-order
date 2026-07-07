import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

const salesDir = 'G:\\マイドライブ\\うおらぼ イサテン請求書\\売上元データ';
const bunniDir = 'G:\\マイドライブ\\うおらぼ イサテン請求書\\キリン分荷表';

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const headers = lines[0].split(',').map(h => h.trim().replace(/^\uFEFF/, ''));
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h] = (vals[i] || '').trim(); });
    return row;
  });
}

function analyzeSales() {
  const files = fs.readdirSync(salesDir).filter(f => f.startsWith('CSV_') && f.endsWith('.csv')).sort();
  const stores = new Set();
  const products = new Set();
  const dates = new Set();
  const byStore = {};
  const byProduct = {};
  const byDate = {};
  const byStoreProduct = {};
  const sampleStores = {};
  let rows = 0;

  for (const f of files) {
    let text;
    try { text = fs.readFileSync(path.join(salesDir, f), 'utf8'); }
    catch { text = fs.readFileSync(path.join(salesDir, f), 'utf16le'); }
    const data = parseCsv(text);
    for (const row of data) {
      if (!row['店舗名']) continue;
      rows++;
      stores.add(row['店舗名']);
      products.add(row['商品名']);
      const d = row['検収日'];
      dates.add(d);
      const qty = Number(row['受領数量'] || 0);
      byStore[row['店舗名']] = (byStore[row['店舗名']] || 0) + qty;
      byProduct[row['商品名']] = (byProduct[row['商品名']] || 0) + qty;
      byDate[d] = (byDate[d] || 0) + 1;
      const key = row['店舗名'] + '::' + row['商品名'];
      byStoreProduct[key] = (byStoreProduct[key] || 0) + qty;
      if (!sampleStores[row['店舗名']]) sampleStores[row['店舗名']] = row['店舗コード'];
    }
  }

  const topProducts = Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 20);
  return {
    files: files.length,
    fileRange: [files[0], files[files.length - 1]],
    rows,
    stores: [...stores].sort().map(s => ({ name: s, code: sampleStores[s], totalQty: byStore[s] })),
    productCount: products.size,
    dateRange: dates.size ? [Math.min(...dates), Math.max(...dates)] : [],
    topProducts,
    dailyRows: Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0])).slice(-7),
  };
}

function readXlsxSummary(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const sheets = wb.SheetNames.map(name => {
    const ws = wb.Sheets[name];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const headers = (data[0] || []).map(String);
    const sampleRows = data.slice(1, 4);
    return { name, rowCount: data.length - 1, headers: headers.slice(0, 15), sampleRows };
  });
  return { file: path.basename(filePath), sheets };
}

function analyzeBunni() {
  const targets = [
    path.join(bunniDir, '畑光発注書_分荷表_原本.xlsx'),
    path.join(bunniDir, '畑光発注書_分荷表_7-7(火)_CSV数量比率按分２２.xlsx'),
    path.join(bunniDir, '畑光ラベル印刷1週間出荷数量.xlsx'),
  ].filter(fs.existsSync);

  return targets.map(readXlsxSummary);
}

const sales = analyzeSales();
const bunni = analyzeBunni();
console.log(JSON.stringify({ sales, bunni }, null, 2));
