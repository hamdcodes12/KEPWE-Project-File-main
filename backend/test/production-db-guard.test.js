import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const backendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./src/config/db.js')"], {
  cwd: backendDirectory,
  encoding: 'utf8',
  env: { ...process.env, NODE_ENV: 'production', KEPWE_PGLITE_TEST: 'true', SUPABASE_DB_URL: '' },
});

assert.notEqual(result.status, 0);
assert.match(result.stderr, /PGlite test storage is forbidden in production/);
console.log('Production database guard rejects PGlite test storage.');