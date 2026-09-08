// OANOR API endpoint discovery script.
// Reads OANOR_API_KEY from .env (never prints it).
// Probes candidate base URLs + generates endpoint combinations programmatically.
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

const BASE_URLS = [
  'https://api.anoar.in',
  'https://api.anoar.com',
  'https://anoar.in/api',
  'https://api.oanor.in',
  'https://api.oanor.com',
  'https://www.anoar.in/api',
  'https://anoar.com/api',
];

// Generate endpoint paths programmatically
const paths = new Set(['/', '/health', '/v1/health']);

const basePaths = [
  'indices', 'market/indices', 'quote', 'market/quote', 'quotes', 'market/quotes',
  'option-chain', 'options/chain', 'market/option-chain',
  'strategies', 'market/strategies', 'expiry', 'expiries', 'market/expiries',
];

for (const p of basePaths) {
  paths.add(`/v1/${p}`);
  paths.add(`/v1/${p}/NIFTY`);
  paths.add(`/v1/${p}?symbol=NIFTY`);
  paths.add(`/v1/${p}?symbol=NIFTY&expiry=28AUG2026`);
  paths.add(`/v1/${p}?symbol=NIFTY&expiry=28AUG`);
  paths.add(`/v1/${p}?symbol=NIFTY&expiry=28AUG2026&strike=24800`);
  paths.add(`/v1/${p}?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE`);
  paths.add(`/v1/${p}?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE`);
  paths.add(`/v1/${p}?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE`);
  paths.add(`/v1/${p}?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE`);
  paths.add(`/v1/${p}?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX`);
  paths.add(`/v1/${p}?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX`);
  paths.add(`/v1/${p}?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE`);
  paths.add(`/v1/${p}?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE`);
  paths.add(`/v1/${p}?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ`);
  paths.add(`/v1/${p}?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ`);
  paths.add(`/v1/${p}?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800`);
  paths.add(`/v1/${p}?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800`);
  paths.add(`/v1/${p}?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=CE&optionType=CE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026`);
  paths.add(`/v1/${p}?symbol=NIFTY&expiry=28AUG2026&strike=24800&type=PE&optionType=PE&instrumentType=OPTIDX&exchange=NSE&segment=EQ&strikePrice=24800&expiryDate=28AUG2026`);
}

const TIMEOUT_MS = 5000;

async function probe(baseUrl, path) {
  const url = `${baseUrl}${path}`;
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
  console.log('Probing OANOR API endpoints...\n');
  let found = 0;

  for (const baseUrl of BASE_URLS) {
    // First check if the base URL is reachable at all
    const root = await probe(baseUrl, '/');
    if (root.status === 0) {
      console.log(`[SKIP] ${baseUrl} unreachable (${root.error})`);
      continue;
    }
    console.log(`[BASE] ${baseUrl} -> HTTP ${root.status}`);

    for (const path of paths) {
      const r = await probe(baseUrl, path);
      if (r.status >= 200 && r.status < 500 && r.status !== 404) {
        found++;
        console.log(`  [HIT] ${r.status} ${r.url}`);
      }
    }
  }

  console.log(`\nDone. ${found} non-404 responses found.`);
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});