/**
 * GAS プロジェクトから node_modules 等の誤 push を除去し、必要ファイルだけ残す
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const claspJson = JSON.parse(fs.readFileSync(path.join(__dirname, '.clasp.json'), 'utf8'));
const claspRc = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE, '.clasprc.json'), 'utf8'));
const scriptId = claspJson.scriptId;
const token = claspRc.tokens.default.access_token;

const KEEP = [
  { local: 'appsscript.json', name: 'appsscript', type: 'JSON' },
  { local: 'Code.gs', name: 'Code', type: 'SERVER_JS' },
  { local: 'RealMasterData.gs', name: 'RealMasterData', type: 'SERVER_JS' },
  { local: 'Index.html', name: 'Index', type: 'HTML' },
];

async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) throw new Error(`${res.status} ${url}\n${JSON.stringify(data, null, 2)}`);
  return data;
}

const before = await api(`https://script.googleapis.com/v1/projects/${scriptId}/content`);
console.log('Before:', before.files?.length, 'files');

const files = KEEP.map(({ local, name, type }) => ({
  name,
  type,
  source: fs.readFileSync(path.join(__dirname, local), 'utf8'),
}));

await api(`https://script.googleapis.com/v1/projects/${scriptId}/content`, {
  method: 'PUT',
  body: JSON.stringify({ files }),
});

const after = await api(`https://script.googleapis.com/v1/projects/${scriptId}/content`);
console.log('After:', after.files?.map((f) => f.name).join(', '));
console.log('Cleanup complete.');
