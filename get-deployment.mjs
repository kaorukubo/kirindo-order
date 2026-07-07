import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const claspJson = JSON.parse(fs.readFileSync(path.join(__dirname, '.clasp.json'), 'utf8'));
const claspRc = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE, '.clasprc.json'), 'utf8'));
const scriptId = claspJson.scriptId;
const deploymentId = process.argv[2] || 'AKfycbyChZLNarcgVdwFkJFNSqbfp_n1tdp3FWJVN5kkBh5e3-sI0JrssSJi1hoztBMXQKsz6g';
const token = claspRc.tokens.default.access_token;

const res = await fetch(`https://script.googleapis.com/v1/projects/${scriptId}/deployments/${deploymentId}`, {
  headers: { Authorization: `Bearer ${token}` },
});
console.log(await res.text());
