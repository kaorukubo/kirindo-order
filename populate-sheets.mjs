/**
 * スプレッドシートにサンプルマスタを直接書き込む
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const claspJson = JSON.parse(fs.readFileSync(path.join(__dirname, '.clasp.json'), 'utf8'));
const claspRc = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE, '.clasprc.json'), 'utf8'));
const spreadsheetId = claspJson.parentId;
const token = claspRc.tokens.default.access_token;

const STORES = [
  'キリン堂 本店', 'キリン堂 駅前店', 'キリン堂 緑店',
  'キリン堂 浜店', 'キリン堂 丘店', 'キリン堂 南店',
];
const PRODUCTS = [
  ['キャベツ', 12], ['にんじん', 10], ['玉ねぎ', 20], ['バナナ', 15],
  ['りんご', 20], ['トマト', 12], ['レタス', 10], ['じゃがいも', 15],
];
const BASE_DISPLAY = {
  'キャベツ': 20, 'にんじん': 15, '玉ねぎ': 25, 'バナナ': 18,
  'りんご': 22, 'トマト': 16, 'レタス': 14, 'じゃがいも': 20,
};
const STORE_SCALE = [1.0, 0.9, 0.75, 0.65, 0.55, 0.45];

const RESULT_HEADERS = [
  '日付', '商品名', '総発注数（個数）', 'ケース数', 'バラ数',
  '店舗1振分', '店舗2振分', '店舗3振分', '店舗4振分', '店舗5振分', '店舗6振分',
  '店舗1ロス', '店舗2ロス', '店舗3ロス', '店舗4ロス', '店舗5ロス', '店舗6ロス',
  '天候', '確定日時',
];

async function sheetsApi(path, options = {}) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data, null, 2));
  return data;
}

function buildData() {
  const productRows = PRODUCTS.map(p => [p[0], p[1]]);
  const storeProductRows = [];
  STORES.forEach((store, si) => {
    PRODUCTS.forEach(p => {
      const base = BASE_DISPLAY[p[0]] || 10;
      storeProductRows.push([store, p[0], Math.max(1, Math.round(base * STORE_SCALE[si]))]);
    });
  });

  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const weathers = ['晴れ', '曇り', '雨'];
  const dayWeatherRows = [];
  days.forEach(day => {
    weathers.forEach(weather => {
      let coef = 1.0;
      const isWeekend = day === '日' || day === '土';
      const isFriday = day === '金';
      if (weather === '晴れ') coef = isWeekend ? 1.3 : (isFriday ? 1.15 : 1.0);
      else if (weather === '曇り') coef = isWeekend ? 1.1 : (isFriday ? 1.0 : 0.95);
      else if (weather === '雨') coef = isWeekend ? 0.9 : (isFriday ? 0.88 : 0.85);
      dayWeatherRows.push([day, weather, coef]);
    });
  });

  const historicalRows = [
    ['2025-07-01', 'キャベツ', 36, 3, 0, 8, 7, 6, 5, 4, 3, 2, 1, 1, 0, 1, 0, '晴れ', '2025-07-01 06:30:00'],
    ['2025-07-01', 'にんじん', 30, 3, 0, 6, 5, 5, 4, 3, 2, 1, 2, 0, 1, 0, 0, '晴れ', '2025-07-01 06:30:00'],
    ['2025-07-02', 'キャベツ', 24, 2, 0, 6, 5, 4, 3, 3, 2, 3, 2, 1, 1, 0, 0, '曇り', '2025-07-02 06:45:00'],
    ['2025-07-03', 'りんご', 40, 2, 0, 9, 8, 7, 6, 5, 4, 2, 1, 2, 1, 0, 1, '雨', '2025-07-03 07:00:00'],
  ];

  return {
    '商品マスタ': [['商品名', '発注単位（ケース入数）'], ...productRows],
    '店舗・商品別マスタ': [['店舗名', '商品名', '基本陳列数'], ...storeProductRows],
    '曜日・天候マスタ': [['曜日', '天候', '係数'], ...dayWeatherRows],
    '発注・振分実績': [RESULT_HEADERS, ...historicalRows],
    '過去実績インポート': [RESULT_HEADERS],
  };
}

async function main() {
  const sheetData = buildData();
  const sheetNames = Object.keys(sheetData);

  // 既存シート削除して作り直し
  const meta = await sheetsApi('');
  const requests = [];

  if (meta.sheets?.length) {
    meta.sheets.forEach(s => {
      if (s.properties.sheetId !== 0) {
        requests.push({ deleteSheet: { sheetId: s.properties.sheetId } });
      }
    });
  }

  sheetNames.forEach((name, i) => {
    if (i === 0) {
      requests.push({ updateSheetProperties: {
        properties: { sheetId: 0, title: name },
        fields: 'title',
      }});
    } else {
      requests.push({ addSheet: { properties: { title: name } } });
    }
  });

  await sheetsApi(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests }) });

  const meta2 = await sheetsApi('');
  const nameToId = {};
  meta2.sheets.forEach(s => { nameToId[s.properties.title] = s.properties.sheetId; });

  const valueRequests = sheetNames.map(name => ({
    updateCells: {
      range: { sheetId: nameToId[name], startRowIndex: 0, startColumnIndex: 0 },
      rows: sheetData[name].map(row => ({
        values: row.map(cell => {
          if (typeof cell === 'number') return { userEnteredValue: { numberValue: cell } };
          return { userEnteredValue: { stringValue: String(cell) } };
        }),
      })),
      fields: 'userEnteredValue',
    },
  }));

  await sheetsApi(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: valueRequests }) });

  console.log('Spreadsheet populated:', `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
  console.log('Sheets:', sheetNames.join(', '));
}

main().catch(err => { console.error(err.message || err); process.exit(1); });
