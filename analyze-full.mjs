import fs from 'fs';
import path from 'path';
import iconv from 'iconv-lite';
import XLSX from 'xlsx';

const salesDir = 'G:\\マイドライブ\\うおらぼ イサテン請求書\\売上元データ';
const bunniDir = 'G:\\マイドライブ\\うおらぼ イサテン請求書\\キリン分荷表';

function analyzeSales() {
  const files = fs.readdirSync(salesDir).filter(f => f.endsWith('.csv')).sort();
  const stores = new Map();
  const products = new Map();
  const byDate = new Map();
  const byStore = new Map();
  let rows = 0;

  for (const f of files) {
    const buf = fs.readFileSync(path.join(salesDir, f));
    const text = iconv.decode(buf, 'Shift_JIS');
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0].split(',').map(h => h.trim());
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const v = line.split(',');
      const row = Object.fromEntries(headers.map((h, i) => [h, (v[i] || '').trim()]));
      if (!row['店舗名']) continue;
      rows++;
      stores.set(row['店舗名'], row['店舗コード']);
      const qty = Number(row['受領数量'] || 0);
      products.set(row['商品名'], (products.get(row['商品名']) || 0) + qty);
      byStore.set(row['店舗名'], (byStore.get(row['店舗名']) || 0) + qty);
      byDate.set(row['検収日'], (byDate.get(row['検収日']) || 0) + 1);
    }
  }

  return {
    files: files.length,
    period: [files[0], files[files.length - 1]],
    rows,
    stores: [...stores.entries()].map(([name, code]) => ({ name, code, totalQty: byStore.get(name) })),
    productCount: products.size,
    topProducts: [...products.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15),
    recentDays: [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-7),
    columns: ['取込日', '検収日', '発注日', '納品日', '伝票番号', '店舗コード', '店舗名', '商品コード', '商品名', '受領数量', '原単価', '売単価'],
  };
}

function analyzeBunniSheet(filePath) {
  const wb = XLSX.readFile(filePath, { cellDates: true });
  const ws = wb.Sheets['発注書'];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // 店舗名行を探す（ヘッダー付近）
  let storeNames = [];
  let headerRow = -1;
  for (let r = 0; r < Math.min(30, data.length); r++) {
    const row = data[r].map(c => String(c));
    if (row.some(c => c.includes('西鈴') || c.includes('店'))) {
      storeNames = row.filter(c => c && (c.includes('店') || c.includes('西') || c.includes('鈴')));
      if (storeNames.length >= 3) { headerRow = r; break; }
    }
  }

  // 商品行サンプル
  const items = [];
  for (let r = 0; r < data.length; r++) {
    const name = String(data[r][1] || data[r][0] || '');
    if (/レタス|人参|玉葱|トマト|キャベ|きゅう|サニー|商品名|品目/.test(name)) {
      items.push({ row: r + 1, label: name, values: data[r].slice(0, 20).filter(x => x !== '') });
    }
    if (items.length >= 8) break;
  }

  // 引取日
  let pickupDate = '';
  for (let r = 0; r < 10; r++) {
    if (String(data[r][0]).includes('引取')) pickupDate = String(data[r][1]);
  }

  return {
    file: path.basename(filePath),
    sheets: wb.SheetNames,
    pickupDate,
    storeHeaderRow: headerRow + 1,
    storeNames: storeNames.slice(0, 10),
    sampleItems: items,
  };
}

function analyzeLabelSheet() {
  const filePath = path.join(bunniDir, '畑光ラベル印刷1週間出荷数量.xlsx');
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets['1週間出荷数量リスト'];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const headerIdx = data.findIndex(r => String(r[0]) === 'No' || String(r[1]) === '品目');
  const headers = headerIdx >= 0 ? data[headerIdx] : [];
  const rows = data.slice(headerIdx + 1, headerIdx + 11).map(r => ({
    no: r[0], item: r[1], weekTotal: r[2], key: r[8], qty: r[9],
  }));
  return {
    period: String(data[0][0]),
    headers: headers.filter(Boolean),
    sampleRows: rows,
  };
}

const sales = analyzeSales();
const bunni = analyzeBunniSheet(path.join(bunniDir, '畑光発注書_分荷表_7-7(火)_CSV数量比率按分２２.xlsx'));
const bunniOriginal = analyzeBunniSheet(path.join(bunniDir, '畑光発注書_分荷表_原本.xlsx'));
const label = analyzeLabelSheet();

console.log(JSON.stringify({ sales, bunni, bunniOriginal, label }, null, 2));
