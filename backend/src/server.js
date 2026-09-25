import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';
import app from './app.js';
import { pool, testConnection } from './config/db.js';
import { validateRuntimeEnvironment } from './config/env.js';
import { startAlgoRunner } from './algo/runner.js';
import { startBrokerExecutionWorker } from './services/broker-execution.worker.js';
import { expireTrials, expireSubscriptions } from './services/subscription.service.js';

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

// ── Subscription expiry cron ────────────────────────────────────────────────
// Runs every 15 minutes. The underlying stored functions are idempotent and
// safe to call concurrently. If this process restarts mid-run the next tick
// will pick up any missed expirations.
const EXPIRY_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

function startSubscriptionExpiryCron() {
  const runExpiry = async () => {
    try {
      const [trialCount, subCount] = await Promise.all([
        expireTrials(),
        expireSubscriptions(),
      ]);
      if (trialCount > 0 || subCount > 0) {
        console.log(
          `[cron] Subscription expiry: ${trialCount} trial(s), ${subCount} paid subscription(s) expired`
        );
      }
    } catch (err) {
      // Non-fatal — log and continue; will retry on next tick
      console.error('[cron] Subscription expiry error:', err.message);
    }
  };

  // Run once immediately on startup to catch any expirations that occurred
  // while the server was down, then on the regular interval.
  runExpiry();
  setInterval(runExpiry, EXPIRY_INTERVAL_MS);
  console.log('[server] Subscription expiry cron started (interval: 15 min)');
}

async function start() {
  validateRuntimeEnvironment();
  await testConnection();

  app.listen(PORT, HOST, () => {
    console.log(`[server] KEPWE app running on port ${PORT} (env: ${process.env.NODE_ENV || 'development'})`);
    console.log(`[server] API base: /api`);
    startAlgoRunner();
    startBrokerExecutionWorker(pool);
    startSubscriptionExpiryCron();
  });
}

start().catch((err) => {
  console.error(`[server] Failed to start: ${err.message}`);
  process.exit(1);
});
