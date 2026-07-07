import fs from 'fs';
import path from 'path';
import iconv from 'iconv-lite';

const salesDir = 'G:\\マイドライブ\\うおらぼ イサテン請求書\\売上元データ';
const STORES = [
  { name: '吾妻通店', code: '000755', short: '吾妻' },
  { name: '西鈴蘭台店', code: '000222', short: '西鈴' },
  { name: '三田学園前店', code: '000259', short: '三田' },
  { name: '須磨北落合店', code: '000833', short: '北スマ' },
];

const sp = {};
const pc = {};
const files = fs.readdirSync(salesDir).filter(f => f.endsWith('.csv'));
for (const f of files) {
  const t = iconv.decode(fs.readFileSync(path.join(salesDir, f)), 'Shift_JIS');
  const lines = t.trim().split(/\r?\n/);
  const h = lines[0].split(',').map(x => x.trim());
  for (const line of lines.slice(1)) {
    const v = line.split(',');
    const row = Object.fromEntries(h.map((x, i) => [x, (v[i] || '').trim()]));
    if (!row['商品名'] || !row['店舗名']) continue;
    const k = row['店舗名'] + '::' + row['商品名'];
    sp[k] = (sp[k] || 0) + Number(row['受領数量'] || 0);
    pc[row['商品名']] = (pc[row['商品名']] || 0) + Number(row['受領数量'] || 0);
  }
}

const dayCount = 28;
const products = Object.entries(pc).sort((a, b) => b[1] - a[1]).map(x => x[0]);
const storeProducts = [];
products.forEach(p => {
  STORES.forEach(s => {
    const total = sp[s.name + '::' + p] || 0;
    const avg = total > 0 ? Math.max(1, Math.round(total / dayCount)) : 0;
    storeProducts.push([s.name, p, avg]);
  });
});

fs.writeFileSync('real-master.json', JSON.stringify({
  STORES,
  productRows: products.map(p => [p, 1]),
  storeProducts,
}, null, 2));
console.log('OK', products.length, 'products');
