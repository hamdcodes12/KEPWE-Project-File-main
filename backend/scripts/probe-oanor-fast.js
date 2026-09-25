// Fast OANOR API probe against confirmed reachable base URL.
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
  '/',
  '/health',
  '/v1/health',
  '/v1/indices',
  '/v1/market/indices',
  '/v1/quote',
  '/v1/market/quote',
  '/v1/quotes',
  '/v1/market/quotes',
  '/v1/option-chain',
  '/v1/options/chain',
  '/v1/market/option-chain',
  '/v1/strategies',
  '/v1/market/strategies',
  '/v1/expiry',
  '/v1/expiries',
  '/v1/market/expiries',
  '/v1/indices/NIFTY',
  '/v1/market/indices/NIFTY',
  '/v1/quote/NIFTY',
  '/v1/market/quote/NIFTY',
  '/v1/option-chain/NIFTY',
  '/v1/options/chain/NIFTY',
  '/v1/market/option-chain/NIFTY',
  '/v1/indices?symbol=NIFTY',
  '/v1/market/indices?symbol=NIFTY',
  '/v1/quote?symbol=NIFTY',
  '/v1/market/quote?symbol=NIFTY',
  '/v1/option-chain?symbol=NIFTY',
  '/v1/options/chain?symbol=NIFTY',
  '/v1/market/option-chain?symbol=NIFTY',
  '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026',
  '/v1/options/chain?symbol=NIFTY&expiry=28AUG2026',
  '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026',
  '/v1/option-chain?symbol=NIFTY&expiry=28AUG',
  '/v1/options/chain?symbol=NIFTY&expiry=28AUG',
  '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG',
  '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800',
  '/v1/options/chain?symbol=NIFTY&expiry=28AUG2026&strike=24800',
  '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800',
  '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE',
  '/v1/options/chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE',
  '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE',
  '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE',
  '/v1/options/chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE',
  '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE',
  '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE',
  '/v1/options/chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE',
  '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE',
  '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE',
  '/v1/options/chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE',
  '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE',
  '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX',
  '/v1/options/chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX',
  '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX',
  '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX',
  '/v1/options/chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX',
  '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX',
  '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE',
  '/v1/options/chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE',
  '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE',
  '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE',
  '/v1/options/chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE',
  '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE',
  '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ',
  '/v1/options/chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ',
  '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ',
  '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ',
  '/v1/options/chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ',
  '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ',
  '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800',
  '/v1/options/chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800',
  '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800',
  '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800',
  '/v1/options/chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800',
  '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800',
  '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026',
  '/v1/options/chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026',
  '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026',
  '/v1/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026',
  '/v1/options/chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026',
  '/v1/market/option-chain?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026',
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
    return { status: res.status, ok: res.ok, url };
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
    }
  }

  console.log(`\nDone. ${found} non-404 responses found.`);
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});