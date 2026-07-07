/**
 * 売上CSVを集計し GAS 経由で「販売実績」へ投入
 */
import fs from 'fs';
import path from 'path';
import iconv from 'iconv-lite';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const claspJson = JSON.parse(fs.readFileSync(path.join(__dirname, '.clasp.json'), 'utf8'));
const claspRc = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE, '.clasprc.json'), 'utf8'));
const scriptId = claspJson.scriptId;
const token = claspRc.tokens.default.access_token;
const SALES_DIR = 'G:\\マイドライブ\\うおらぼ イサテン請求書\\売上元データ';
const CHUNK = 400;

function parseCsvDate(v) {
  const s = String(v || '').trim();
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return s;
}

function aggregateSales() {
  const files = fs.readdirSync(SALES_DIR).filter((f) => f.endsWith('.csv')).sort();
  const map = new Map();
  for (const file of files) {
    const text = iconv.decode(fs.readFileSync(path.join(SALES_DIR, file)), 'Shift_JIS');
    const lines = text.trim().split(/\r?\n/);
    const headers = lines[0].split(',').map((h) => h.trim());
    const iDate = headers.indexOf('検収日');
    const iStore = headers.indexOf('店舗名');
    const iProduct = headers.indexOf('商品名');
    const iQty = headers.indexOf('受領数量');
    if (iDate < 0 || iStore < 0 || iProduct < 0 || iQty < 0) continue;
    for (const line of lines.slice(1)) {
      if (!line.trim()) continue;
      const cols = line.split(',');
      const date = parseCsvDate(cols[iDate]);
      const store = (cols[iStore] || '').trim();
      const product = (cols[iProduct] || '').trim();
      const qty = Math.round(Number(cols[iQty]) || 0);
      if (!date || !store || !product || qty <= 0) continue;
      const key = `${date}::${store}::${product}`;
      map.set(key, (map.get(key) || 0) + qty);
    }
  }
  return [...map.entries()].map(([key, qty]) => {
    const [date, store, product] = key.split('::');
    return [date, store, product, qty, 0];
  });
}

async function runGAS(fn, params = []) {
  const res = await fetch(`https://script.googleapis.com/v1/scripts/${scriptId}:run`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ function: fn, parameters: params, devMode: true }),
  });
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error, null, 2));
  return data.response?.result;
}

async function main() {
  const rows = aggregateSales();
  console.log('Aggregated rows:', rows.length);

  await runGAS('initSampleData');
  console.log('Master rebuilt');

  await runGAS('clearOrderResults_');
  console.log('Order results cleared');

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const res = await runGAS('bulkReplaceSalesChunk', [chunk, i === 0]);
    console.log(`Chunk ${Math.floor(i / CHUNK) + 1}: +${res.added} (total ${res.totalRows})`);
  }

  const dates = [...new Set(rows.map((r) => r[0]))].sort();
  console.log('Date range:', dates[0], '〜', dates[dates.length - 1]);
  console.log('Done');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
