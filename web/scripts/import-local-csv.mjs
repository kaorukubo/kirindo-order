/**
 * ローカル CSV → API 一括取込
 * 使い方: node scripts/import-local-csv.mjs http://localhost:3000
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SALES_DIR = process.env.SALES_DIR || 'G:\\マイドライブ\\うおらぼ イサテン請求書\\売上元データ';
const BASE = process.argv[2] || 'http://localhost:3000';

async function main() {
  const files = fs.readdirSync(SALES_DIR).filter((f) => f.endsWith('.csv'));
  console.log(`Uploading ${files.length} CSV files to ${BASE}...`);

  const form = new FormData();
  for (const f of files) {
    const buf = fs.readFileSync(path.join(SALES_DIR, f));
    form.append('files', new Blob([buf]), f);
  }

  const res = await fetch(`${BASE}/api/import-sales`, { method: 'POST', body: form });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
