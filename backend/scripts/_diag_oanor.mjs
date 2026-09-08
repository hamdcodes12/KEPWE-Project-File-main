import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../../.env') });

const API_KEY = process.env.OANOR_API_KEY;
const BASE = process.env.OANOR_BASE_URL || 'https://api.oanor.com';
console.log('Using base:', BASE, 'key set:', !!API_KEY, 'key length:', API_KEY ? API_KEY.length : 0);

const paths = [
  '/indices?symbol=NIFTY',
  '/option-chain?symbol=NIFTY&expiry=28AUG2026',
  '/strategies',
  '/health',
];

for (const p of paths) {
  try {
    const res = await fetch(`${BASE}${p}`, {
      headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' },
    });
    const text = await res.text();
    console.log(`${p} -> ${res.status}: ${text.slice(0, 300)}`);
  } catch (err) {
    console.log(`${p} -> ERROR: ${err.message}`);
  }
}
