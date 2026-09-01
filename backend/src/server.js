import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';
import app from './app.js';
import { testConnection } from './config/db.js';
import { validateRuntimeEnvironment } from './config/env.js';
import { startAlgoRunner } from './algo/runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (3 levels up: src/server.js -> backend -> root)
dotenv.config({ path: resolve(__dirname, '../../.env') });
dotenv.config();

// Render injects PORT automatically; the app MUST listen on it.
const PORT = process.env.PORT || 3001;
// Bind to all interfaces — required for the app to be reachable inside
// Render's container network (binding to 'localhost' only would make the
// service unreachable from Render's routing layer).
const HOST = '0.0.0.0';

async function start() {
  validateRuntimeEnvironment();
  await testConnection();

  app.listen(PORT, HOST, () => {
    console.log(`[server] KEPWE app running on port ${PORT} (env: ${process.env.NODE_ENV || 'development'})`);
    console.log(`[server] API base: /api`);
    startAlgoRunner();
  });
}

start().catch((err) => {
  console.error(`[server] Failed to start: ${err.message}`);
  process.exit(1);
});
