// Focused OANOR API probe - tests most likely paths with query-param auth.
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

const BASES = ['https://api.oanor.com', 'https://api.anoar.in'];

// Most likely paths based on common market data API patterns
const paths = [
  '/', '/health', '/api/health', '/v1/health',
  '/api/indices', '/api/market/indices', '/v1/indices', '/v1/market/indices',
  '/api/quote', '/api/market/quote', '/v1/quote', '/v1/market/quote',
  '/api/quotes', '/api/market/quotes', '/v1/quotes', '/v1/market/quotes',
  '/api/option-chain', '/api/options/chain', '/api/market/option-chain',
  '/v1/option-chain', '/v1/options/chain', '/v1/market/option-chain',
  '/api/strategies', '/api/market/strategies', '/v1/strategies', '/v1/market/strategies',
  '/api/expiries', '/v1/expiries', '/api/market/expiries', '/v1/market/expiries',
  '/api/indices/NIFTY', '/v1/indices/NIFTY', '/api/market/indices/NIFTY', '/v1/market/indices/NIFTY',
  '/api/quote/NIFTY', '/v1/quote/NIFTY', '/api/market/quote/NIFTY', '/v1/market/quote/NIFTY',
  '/api/option-chain/NIFTY', '/v1/option-chain/NIFTY', '/api/market/option-chain/NIFTY', '/v1/market/option-chain/NIFTY',
  '/api/indices?symbol=NIFTY', '/v1/indices?symbol=NIFTY',
  '/api/market/indices?symbol=NIFTY', '/v1/market/indices?symbol=NIFTY',
  '/api/quote?symbol=NIFTY', '/v1/quote?symbol=NIFTY',
  '/api/market/quote?symbol=NIFTY', '/v1/market/quote?symbol=NIFTY',
  '/api/option-chain?symbol=NIFTY', '/v1/option-chain?symbol=NIFTY',
  '/api/options/chain?symbol=NIFTY', '/v1/options/chain?symbol=NIFTY',
  '/api/market/option-chain?symbol=NIFTY', '/v1/market/option-chain?symbol=NIFTY',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026', '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026', '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800', '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800', '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE', '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE', '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE', '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE', '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE', '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE', '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE', '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE', '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX', '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX', '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX', '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX', '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE', '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE', '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE', '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE', '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ', '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ', '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ', '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ', '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800', '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800', '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800', '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800', '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026', '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026', '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026', '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026', '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026',
];

// Query param auth styles
const queryAuth = [
  (key) => `api_key=${key}`,
  (key) => `apikey=${key}`,
  (key) => `key=${key}`,
  (key) => `apiKey=${key}`,
  (key) => `token=${key}`,
  (key) => `access_token=${key}`,
];

const TIMEOUT_MS = 3000;

async function probe(url, headers = {}) {
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
  console.log('Focused OANOR API probe...\n');
  let found = 0;

  for (const base of BASES) {
    console.log(`\n=== ${base} ===`);

    // Test with Bearer auth header
    for (const path of paths) {
      const url = `${base}${path}`;
      const r = await probe(url, { Authorization: `Bearer ${API_KEY}` });
      if (r.status >= 200 && r.status < 500 && r.status !== 404) {
        found++;
        console.log(`  [HIT] ${r.status} ${r.url} (Bearer)`);
      }
    }

    // Test with query param auth on key paths
    for (const path of paths.slice(0, 20)) {
      for (const qa of queryAuth) {
        const sep = path.includes('?') ? '&' : '?';
        const url = `${base}${path}${sep}${qa(API_KEY)}`;
        const r = await probe(url);
        if (r.status >= 200 && r.status < 500 && r.status !== 404) {
          found++;
          console.log(`  [HIT] ${r.status} ${r.url} (query)`);
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