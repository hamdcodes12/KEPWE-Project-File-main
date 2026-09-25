import dotenv from 'dotenv';
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment
dotenv.config({ path: resolve(__dirname, '../../.env') });

console.log('[migrate-safe] Starting safe migration with IPv4 enforcement...');

// Force IPv4 by setting family: 4 in environment
process.env.NODE_OPTIONS = (process.env.NODE_OPTIONS || '') + ' --dns-result-order=ipv4first';

// Run migration
const child = spawn('node', ['db/migrate.js'], {
  cwd: resolve(__dirname, '..'),
  stdio: 'inherit',
  env: {
    ...process.env,
    // Force DNS resolution order to prefer IPv4
    NODE_OPTIONS: '--dns-result-order=ipv4first'
  }
});

child.on('exit', (code) => {
  if (code === 0) {
    console.log('[migrate-safe] Migration completed successfully');
  } else {
    console.error('[migrate-safe] Migration failed with code:', code);
  }
  process.exit(code);
});