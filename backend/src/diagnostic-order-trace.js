import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: resolve(__dirname, '../../.env') });
dotenv.config();

const { getBrokerReadiness, DhanAdapter } = await import('./algo/broker-adapters.js');
const { getStaticIpReadiness } = await import('./services/static-ip.service.js');

console.log('=== DIAGNOSTIC: LIVE DHAN ORDER SUBMISSION TRACE ===\n');

console.log('## ENVIRONMENT CHECK\n');
console.log('DHAN_API_KEY:', process.env.DHAN_API_KEY ? '✓ SET' : '✗ MISSING');
console.log('DHAN_API_SECRET:', process.env.DHAN_API_SECRET ? '✓ SET' : '✗ MISSING');
console.log('DHAN_STATIC_IP:', process.env.DHAN_STATIC_IP || 'NOT SET');
console.log('OUTBOUND_PUBLIC_IP:', process.env.OUTBOUND_PUBLIC_IP || 'NOT SET');
console.log('RENDER_OUTBOUND_IP:', process.env.RENDER_OUTBOUND_IP || 'NOT SET');

console.log('\n## STATIC IP READINESS\n');
const ipStatus = getStaticIpReadiness('DHAN');
console.log('Configured IP:', ipStatus.configuredIp);
console.log('Detected IP:', ipStatus.detectedIp);
console.log('Match:', ipStatus.match);
console.log('Ready:', ipStatus.ready);
console.log('Status:', ipStatus.status);
console.log('Reason:', ipStatus.reason);

console.log('\n## BROKER READINESS (No User Token)\n');
const adapter1 = new DhanAdapter();
const readiness1 = adapter1.readiness();
console.log('Configured:', readiness1.configured);
console.log('Enabled:', readiness1.enabled);
console.log('Static IP Ready:', readiness1.staticIp?.ready);
console.log('Order Execution Ready:', readiness1.orderExecutionReady);

console.log('\n## BROKER READINESS (With User Token)\n');
const adapter2 = new DhanAdapter({
  dhanClientId: '1100000001',
  accessToken: 'test-token',
  tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
});
const readiness2 = adapter2.readiness();
console.log('Configured:', readiness2.configured);
console.log('Enabled:', readiness2.enabled);
console.log('Static IP Ready:', readiness2.staticIp?.ready);
console.log('Order Execution Ready:', readiness2.orderExecutionReady);

console.log('\n## GET BROKER READINESS (Used in route handler)\n');
const routeReadiness = getBrokerReadiness('DHAN', 'LIVE');
console.log('Result:', JSON.stringify(routeReadiness, null, 2));

console.log('\n## ORDER SUBMISSION FLOW\n');
console.log('Route: POST /api/broker/orders');
console.log('Line 929-933 in algo.routes.js:');
console.log('  if (!getBrokerReadiness(order.broker, "LIVE").orderExecutionReady) {');
console.log('    return res.status(503).json({');
console.log('      error: "Live order execution is blocked...",');
console.log('      code: "STATIC_IP_NOT_READY"');
console.log('    });');
console.log('  }');

if (!getBrokerReadiness('DHAN', 'LIVE').orderExecutionReady) {
  console.log('\n>>> CURRENT STATUS: BLOCKED <<<\n');
  console.log('HTTP Response: 503 Service Unavailable');
  console.log('Code: STATIC_IP_NOT_READY');
  console.log('Message: Live order execution is blocked until production outbound IP readiness is confirmed.');
  
  console.log('\nWhy blocked:');
  console.log('  - OUTBOUND_PUBLIC_IP is not set in environment');
  console.log('  - DHAN_STATIC_IP is set to: 103.117.180.146');
  console.log('  - Cannot verify they match');
  console.log('  - orderExecutionReady = false');
} else {
  console.log('\n>>> CURRENT STATUS: ALLOWED <<<\n');
  console.log('Order would proceed to: Risk Engine evaluation');
}

console.log('\n## FIX REQUIRED\n');
console.log('Set environment variable:');
console.log('  OUTBOUND_PUBLIC_IP=103.117.180.146');
console.log('\nAfter setting, retest:');
console.log('  1. Restart backend server');
console.log('  2. Retry POST /api/broker/orders');
console.log('  3. Should pass 503 check and reach Risk Engine');
