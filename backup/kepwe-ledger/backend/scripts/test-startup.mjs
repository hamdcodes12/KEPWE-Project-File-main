import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('[startup-test] Testing server startup...');

const child = spawn('node', ['src/server.js'], {
  cwd: resolve(__dirname, '..'),
  stdio: 'pipe'
});

let output = '';
let startupSuccessful = false;

child.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  console.log(text.trim());
  
  if (text.includes('KEPWE app running on port')) {
    startupSuccessful = true;
    console.log('[startup-test] ✅ Server startup successful');
    child.kill();
  }
});

child.stderr.on('data', (data) => {
  const text = data.toString();
  output += text;
  console.error(text.trim());
});

child.on('close', (code) => {
  if (startupSuccessful) {
    console.log('[startup-test] ✅ STARTUP TEST PASSED');
    process.exit(0);
  } else {
    console.error('[startup-test] ❌ STARTUP TEST FAILED');
    process.exit(1);
  }
});

// Timeout after 30 seconds
setTimeout(() => {
  if (!startupSuccessful) {
    console.error('[startup-test] ❌ Startup timeout');
    child.kill();
    process.exit(1);
  }
}, 30000);