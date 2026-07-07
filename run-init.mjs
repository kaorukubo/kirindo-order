import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const claspJson = JSON.parse(fs.readFileSync(path.join(__dirname, '.clasp.json'), 'utf8'));
const claspRc = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE, '.clasprc.json'), 'utf8'));
const scriptId = claspJson.scriptId;
const token = claspRc.tokens.default.access_token;

const res = await fetch(`https://script.googleapis.com/v1/scripts/${scriptId}:run`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ function: 'initSampleData', devMode: true }),
});

const data = await res.json();
console.log(JSON.stringify(data, null, 2));
