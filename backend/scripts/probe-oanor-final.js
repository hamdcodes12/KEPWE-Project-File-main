// Final focused OANOR API probe - tests likely endpoints with proper auth.
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

const paths = [
  '/docs', '/api-docs', '/swagger', '/swagger.json', '/openapi.json',
  '/api/docs', '/v1/docs', '/redoc', '/api', '/v1', '/api/v1', '/api/v2', '/v2',
  '/api/v3', '/v3', '/api/market', '/market', '/api/data', '/data',
  '/api/public', '/public', '/api/open', '/open', '/api/health', '/health',
  '/api/status', '/status', '/api/version', '/version',
  '/api/indices', '/indices', '/api/market/indices', '/market/indices',
  '/api/quote', '/quote', '/api/market/quote', '/market/quote',
  '/api/option-chain', '/option-chain', '/api/market/option-chain', '/market/option-chain',
  '/api/options', '/options', '/api/strategies', '/strategies',
  '/api/market/strategies', '/market/strategies', '/api/expiry', '/expiry',
  '/api/expiries', '/expiries', '/api/market/expiries', '/market/expiries',
  '/api/instruments', '/instruments', '/api/symbols', '/symbols',
  '/api/nifty', '/nifty', '/api/nifty50', '/nifty50', '/api/index', '/index',
  '/api/index/NIFTY', '/index/NIFTY', '/api/indices/NIFTY', '/indices/NIFTY',
  '/api/quote/NIFTY', '/quote/NIFTY', '/api/market/quote/NIFTY', '/market/quote/NIFTY',
  '/api/option-chain/NIFTY', '/option-chain/NIFTY', '/api/market/option-chain/NIFTY', '/market/option-chain/NIFTY',
  '/api/options/NIFTY', '/options/NIFTY',
  '/api/indices?symbol=NIFTY', '/indices?symbol=NIFTY',
  '/api/market/indices?symbol=NIFTY', '/market/indices?symbol=NIFTY',
  '/api/quote?symbol=NIFTY', '/quote?symbol=NIFTY',
  '/api/market/quote?symbol=NIFTY', '/market/quote?symbol=NIFTY',
  '/api/option-chain?symbol=NIFTY', '/option-chain?symbol=NIFTY',
  '/api/market/option-chain?symbol=NIFTY', '/market/option-chain?symbol=NIFTY',
  '/api/options?symbol=NIFTY', '/options?symbol=NIFTY',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026', '/option-chain?symbol=NIFTY&expiry=28AUG2026',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026', '/market/option-chain?symbol=NIFTY&expiry=28AUG2026',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800', '/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800', '/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE', '/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE', '/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE', '/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE', '/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE', '/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE', '/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE', '/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE', '/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX', '/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX', '/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX', '/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX', '/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE', '/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE', '/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE', '/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE', '/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ', '/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ', '/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ', '/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ', '/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800', '/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800', '/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800', '/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800', '/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026', '/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026', '/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026',
  '/api/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026', '/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026',
  '/api/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026', '/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026',
];

const TIMEOUT_MS = 3000;

async function probe(path) {
  const url = `${BASE}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}`, 'X-API-Key': API_KEY, Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await res.text();
    return { status: res.status, ok: res.ok, url, body: text.slice(0, 300) };
  } catch (err) {
    clearTimeout(timer);
    return { status: 0, ok: false, url, error: err.name };
  }
}

async function main() {
  console.log(`Probing ${BASE}...\n`);
  let found = 0;

  for (const path of paths) {
    const r = await probe(path);
    if (r.status >= 200 && r.status < 500 && r.status !== 404) {
      found++;
      console.log(`  [HIT] ${r.status} ${r.url}`);
      if (r.body) console.log(`        ${r.body}`);
    }
  }

  console.log(`\nDone. ${found} non-404 responses found.`);
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});