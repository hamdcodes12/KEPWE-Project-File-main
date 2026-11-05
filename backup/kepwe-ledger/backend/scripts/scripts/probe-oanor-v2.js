// Targeted OANOR API probe - tries different path prefixes and auth styles.
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../.env') });
dotenv.config();

const API_KEY = process.env.OANOR_API_KEY;
if (!API_KEY) {
  console.error('OANOR_API_KEY not set in .env');
  process.exit(1);
}

const BASE = 'https://api.oanor.com';

// Try different path prefixes and auth styles
const pathPrefixes = ['', '/api', '/v1', '/v2', '/v3', '/rest', '/market', '/data', '/public', '/open'];
const resourcePaths = [
  'indices', 'market/indices', 'quote', 'market/quote', 'quotes', 'market/quotes',
  'option-chain', 'options/chain', 'market/option-chain', 'optionchain',
  'strategies', 'market/strategies', 'expiry', 'expiries', 'market/expiries',
  'nifty', 'nifty50', 'index', 'index/NIFTY', 'instruments', 'symbols',
  'optionchain/NIFTY', 'option-chain/NIFTY', 'options/chain/NIFTY',
  'market/option-chain/NIFTY', 'optionchain?symbol=NIFTY',
  'option-chain?symbol=NIFTY', 'options/chain?symbol=NIFTY',
  'market/option-chain?symbol=NIFTY', 'indices?symbol=NIFTY',
  'quote?symbol=NIFTY', 'market/quote?symbol=NIFTY',
  'option-chain?symbol=NIFTY&expiry=28AUG2026',
  'option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800',
  'option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE',
  'option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE',
  'option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE',
  'option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE',
  'option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX',
  'option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX',
  'option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE',
  'option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE',
  'option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ',
  'option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ',
  'option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800',
  'option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800',
  'option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026',
  'option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026',
];

// Auth styles to try
const authStyles = [
  (key) => ({ Authorization: `Bearer ${key}` }),
  (key) => ({ 'X-API-Key': key }),
  (key) => ({ 'x-api-key': key }),
  (key) => ({ 'api-key': key }),
  (key) => ({ 'apikey': key }),
  (key) => ({ 'X-Api-Key': key }),
  (key) => ({ 'OANOR-API-Key': key }),
  (key) => ({ 'x-oanor-api-key': key }),
];

const TIMEOUT_MS = 3000;

async function probe(url, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { ...headers, Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    return { status: res.status, ok: res.ok, url };
  } catch (err) {
    clearTimeout(timer);
    return { status: 0, ok: false, url, error: err.name };
  }
}

async function main() {
  console.log(`Probing ${BASE} with different prefixes and auth styles...\n`);
  let found = 0;

  for (const prefix of pathPrefixes) {
    for (const resource of resourcePaths) {
      const path = `${prefix}/${resource}`;
      const url = `${BASE}${path}`;

      for (const authStyle of authStyles) {
        const r = await probe(url, authStyle(API_KEY));
        if (r.status >= 200 && r.status < 500 && r.status !== 404) {
          found++;
          console.log(`  [HIT] ${r.status} ${r.url} auth=${Object.keys(authStyle(API_KEY))[0]}`);
        }
      }
    }
  }

  console.log(`\nDone. ${found} non-404 responses found.`);
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});