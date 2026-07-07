import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const claspJson = JSON.parse(fs.readFileSync(path.join(__dirname, '.clasp.json'), 'utf8'));
const claspRc = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE, '.clasprc.json'), 'utf8'));
const scriptId = claspJson.scriptId;
const token = claspRc.tokens.default.access_token;

const res = await fetch(`https://script.googleapis.com/v1/projects/${scriptId}/content`, {
  headers: { Authorization: `Bearer ${token}` },
});
const data = await res.json();
const manifest = data.files?.find(f => f.name === 'appsscript')?.source;
console.log('Manifest:', manifest);
console.log('Files:', data.files?.map(f => f.name));
