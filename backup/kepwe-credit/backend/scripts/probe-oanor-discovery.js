// OANOR API Discovery Script
// Tests which APIs the current key is subscribed to
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../.env') });
dotenv.config();

const API_KEY = process.env.OANOR_API_KEY;
if (!API_KEY) {
  console.error('OANOR_API_KEY not set in .env');
  process.exit(1);
}

function fetchUrl(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', ...headers } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(new Error('Timeout')); });
  });
}

async function main() {
  console.log('=== Testing OANOR API key access to various APIs ===\n');
  
  // Test a broad set of APIs from the catalog
  const apis = [
    { slug: 'wemix-api', name: 'WEMIX', path: '/v1/status' },
    { slug: 'monad-api', name: 'Monad', path: '/v1/status' },
    { slug: 'superposition-api', name: 'Superposition', path: '/v1/status' },
    { slug: 'matchain-api', name: 'Matchain', path: '/v1/status' },
    { slug: 'bahamut-api', name: 'Bahamut', path: '/v1/status' },
    { slug: 'towns-api', name: 'Towns', path: '/v1/status' },
    { slug: 'kaia-api', name: 'Kaia', path: '/v1/status' },
    { slug: 'zero-api', name: 'Zero', path: '/v1/status' },
    { slug: 'funki-api', name: 'Funki', path: '/v1/status' },
    { slug: 'xpla-api', name: 'XPLA', path: '/v1/status' },
    { slug: 'meter-api', name: 'Meter', path: '/v1/status' },
    { slug: 'rollux-api', name: 'Rollux', path: '/v1/status' },
    { slug: 'songbird-api', name: 'Songbird', path: '/v1/status' },
    { slug: 'sifchain-api', name: 'Sifchain', path: '/v1/status' },
    { slug: 'desmos-api', name: 'Desmos', path: '/v1/status' },
    { slug: 'shentu-api', name: 'Shentu', path: '/v1/status' },
    { slug: 'moldova-cpi-api', name: 'Moldova CPI', path: '/v1/cpi' },
    { slug: 'carbon-api', name: 'Carbon', path: '/v1/status' },
    { slug: 'fetchai-api', name: 'FetchAI', path: '/v1/status' },
    { slug: 'moldova-trade-api', name: 'Moldova Trade', path: '/v1/trade' },
    { slug: 'oraichain-api', name: 'Oraichain', path: '/v1/status' },
    { slug: 'aland-stats-api', name: 'Aland Stats', path: '/v1/cpi' },
    { slug: 'sophon-api', name: 'Sophon', path: '/v1/status' },
  ];

  for (const api of apis) {
    const url = `https://api.oanor.com/${api.slug}${api.path}`;
    console.log(`\n--- ${api.name} (${api.slug}) ---`);
    try {
      const res = await fetchUrl(url, { 'x-oanor-key': API_KEY, 'Accept': 'application/json' });
      console.log('Status:', res.status);
      console.log('Body:', res.body.slice(0, 300));
    } catch (e) {
      console.log('Error:', e.message);
    }
  }
}

main();