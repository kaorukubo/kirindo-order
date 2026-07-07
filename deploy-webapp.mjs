/**
 * WebアプリをデプロイしてURLを表示
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const claspJson = JSON.parse(fs.readFileSync(path.join(__dirname, '.clasp.json'), 'utf8'));
const claspRc = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE, '.clasprc.json'), 'utf8'));
const scriptId = claspJson.scriptId;
const token = claspRc.tokens.default.access_token;

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
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`${res.status} ${url}\n${JSON.stringify(data, null, 2)}`);
  return data;
}

async function main() {
  // 新バージョン作成
  const version = await api(`https://script.googleapis.com/v1/projects/${scriptId}/versions`, {
    method: 'POST',
    body: JSON.stringify({ description: 'Web app v1' }),
  });
  console.log('Version:', version.versionNumber);

  // Webアプリとしてデプロイ（appsscript.json の webapp 設定を使用）
  const deployment = await api(`https://script.googleapis.com/v1/projects/${scriptId}/deployments`, {
    method: 'POST',
    body: JSON.stringify({
      versionNumber: String(version.versionNumber),
      description: '青果発注 Webアプリ v1',
    }),
  });

  const webApp = deployment.entryPoints?.find(e => e.entryPointType === 'WEB_APP')?.webApp;
  const deploymentId = deployment.deploymentId;

  console.log('\n=== デプロイ完了 ===');
  console.log('Deployment ID:', deploymentId);
  if (webApp?.url) {
    console.log('Web App URL:', webApp.url);
  } else {
    console.log('Web App URL:', `https://script.google.com/macros/s/${deploymentId}/exec`);
  }
  console.log('Spreadsheet:', `https://docs.google.com/spreadsheets/d/${claspJson.parentId}/edit`);
  console.log('Script Editor:', `https://script.google.com/home/projects/${scriptId}/edit`);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
