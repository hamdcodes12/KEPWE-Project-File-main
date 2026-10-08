/**
 * KEPWE QUANT - PRODUCTION READINESS CHECK (Angel One SmartAPI)
 *
 * Runs the same read-only live health check the dashboard uses
 * (runAngelOneLiveHealthCheck) for one user and prints every prerequisite.
 * It NEVER places, modifies or cancels an order.
 *
 * Usage: node production-readiness-check.js <user-id>
 *
 * CRITICAL: DO NOT bypass any check. Every safety gate must PASS before live execution.
 */

import 'dotenv/config';
import { pool } from './src/config/db.js';
import { getBrokerReadiness } from './src/algo/broker-adapters.js';
import { runAngelOneLiveHealthCheck } from './src/services/angel-one-live-health.service.js';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  KEPWE QUANT - PRODUCTION READINESS ASSESSMENT (ANGEL ONE)');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('This check verifies every live prerequisite against Angel One SmartAPI.');
  console.log('NO real orders will be placed during this check.\n');

  const userId = process.argv[2];
  if (!userId) {
    console.error('ERROR: User ID required');
    console.error('Usage: node production-readiness-check.js <user-id>');
    process.exit(1);
  }
  console.log(`Testing for user ID: ${userId}\n`);

  let exitCode = 1;
  try {
    const readiness = getBrokerReadiness('ANGEL_ONE', 'LIVE');
    console.log('[CONFIGURATION]');
    console.log(`  SmartAPI key on server : ${readiness.serverApiKeyConfigured ? 'configured' : 'not configured (users supply their own key)'}`);
    console.log(`  Static IP (configured) : ${readiness.staticIp.configuredIp || 'NOT CONFIGURED (ANGEL_ONE_STATIC_IP)'}`);
    console.log(`  NIFTY freeze quantity  : ${process.env.ANGEL_ONE_NIFTY_FREEZE_QTY || 'NOT CONFIGURED (ANGEL_ONE_NIFTY_FREEZE_QTY)'}\n`);

    const health = await runAngelOneLiveHealthCheck(pool, userId);
    console.log('[LIVE PREREQUISITES]');
    for (const [name, result] of Object.entries(health.checks)) {
      console.log(`  ${result.passed ? '✓' : '✗'} ${name}: ${result.status}`);
      console.log(`     ${result.message}`);
    }

    const total = Object.keys(health.checks).length;
    const failed = health.blockers.length;
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  READINESS ASSESSMENT SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log(`Total Checks: ${total}`);
    console.log(`Passed: ${total - failed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Result code: ${health.code}\n`);

    if (!health.ready) {
      console.log('❌ PRODUCTION DEPLOYMENT: BLOCKED\n');
      for (const blocker of health.blockers) {
        console.log(`  ✗ ${blocker.check} [${blocker.status}]`);
        console.log(`    ${blocker.blocker}\n`);
      }
      console.log('IMPORTANT: Do NOT attempt live trading until all checks PASS.');
      console.log('Resolve the failed prerequisites and run this check again.\n');
    } else {
      console.log('✅ ALL CHECKS PASSED\n');
      console.log('Angel One session, market data, instruments, risk configuration, OMS,');
      console.log('order-API static IP and reconciliation prerequisites are all passing.\n');
      exitCode = 0;
    }
  } catch (err) {
    console.error('\n❌ FATAL ERROR during readiness check:');
    console.error(err);
  } finally {
    await pool.end();
  }
  process.exit(exitCode);
}

main();
