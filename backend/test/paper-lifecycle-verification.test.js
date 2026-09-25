import assert from 'assert';
import http from 'http';
import app from '../src/app.js';
import { pool } from '../src/config/db.js';
import { signAccessToken } from '../src/middleware/auth.js';
import { grantProductMembership } from '../src/services/product-membership.service.js';

async function runTest() {
  console.log('--- STARTING PAPER TRADING LIFECYCLE & ISOLATION VERIFICATION ---');
  const server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  try {
    const userRes = await pool.query("SELECT id FROM users WHERE email = 'aliyasafvan@gmail.com' LIMIT 1");
    let userId = userRes.rows[0]?.id;
    if (!userId) {
      const uRes = await pool.query(
        "INSERT INTO users (id, email, password_hash, role, full_name) VALUES (gen_random_uuid(), 'aliyasafvan@gmail.com', 'test', 'customer', 'Aliya Safvan') RETURNING id"
      );
      userId = uRes.rows[0].id;
    }
    await grantProductMembership(userId, 'quant');
    const token = signAccessToken({ id: userId, email: 'aliyasafvan@gmail.com', role: 'customer' });
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    // 1. Reset paper state
    await pool.query('DELETE FROM paper_trades WHERE user_id = $1', [userId]);
    await pool.query("DELETE FROM algo_orders WHERE user_id = $1 AND execution_mode = 'PAPER'", [userId]);

    // 2. Start paper trading
    const sRes = await fetch(base + '/api/quant/paper/start', { method: 'POST', headers }).then(r => r.json());
    console.log('[1] POST /api/quant/paper/start:', sRes);
    assert.strictEqual(sRes.status, 'ACTIVE');

    // 3. Place BUY order (25 units @ ₹185)
    const bRes = await fetch(base + '/api/quant/paper/order', {
      method: 'POST',
      headers,
      body: JSON.stringify({ instrument: 'NIFTY 50 ATM CE', side: 'BUY', quantity: 25, price: 185, stopLoss: 138.75, target: 277.5 })
    }).then(r => r.json());
    console.log('[2] POST /api/quant/paper/order BUY:', { success: bRes.success, orderStatus: bRes.order?.status, tradeStatus: bRes.trade?.status });
    assert.strictEqual(bRes.success, true);
    assert.strictEqual(bRes.order?.status, 'FILLED');
    assert.strictEqual(bRes.order?.execution_mode, 'PAPER');
    assert.strictEqual(bRes.trade?.status, 'OPEN');
    assert.strictEqual(Number(bRes.trade?.entry_price), 185);

    // 4. Fetch Status immediately after BUY
    const st1 = await fetch(base + '/api/quant/paper/status', { headers }).then(r => r.json());
    console.log('[3] GET /api/quant/paper/status (Immediate Refetch):', {
      openPositions: st1.openPositions?.length,
      pos: st1.openPositions?.[0]
    });
    assert.strictEqual(st1.openPositions?.length, 1);
    assert.strictEqual(st1.openPositions[0].instrument, 'NIFTY 50 ATM CE');
    assert.strictEqual(st1.openPositions[0].quantity, 25);
    assert.strictEqual(st1.openPositions[0].entryPrice, 185);
    assert.strictEqual(st1.openPositions[0].currentPrice, 185);

    // 5. Fetch Status simulating Browser Page Refresh
    const st2 = await fetch(base + '/api/quant/paper/status', { headers }).then(r => r.json());
    console.log('[4] GET /api/quant/paper/status (Simulated Page Refresh):', {
      openPositions: st2.openPositions?.length,
      persistedQty: st2.openPositions?.[0]?.quantity
    });
    assert.strictEqual(st2.openPositions?.length, 1);
    assert.strictEqual(st2.openPositions[0].quantity, 25);
    console.log('  ✔ Position successfully persisted in database across simulated page refresh!');

    // 6. Place SELL order to close the position (25 units @ ₹190)
    const sellRes = await fetch(base + '/api/quant/paper/order', {
      method: 'POST',
      headers,
      body: JSON.stringify({ instrument: 'NIFTY 50 ATM CE', side: 'SELL', quantity: 25, price: 190 })
    }).then(r => r.json());
    console.log('[5] POST /api/quant/paper/order SELL:', {
      success: sellRes.success,
      tradeStatus: sellRes.trade?.status,
      exitPrice: sellRes.trade?.exit_price,
      pnl: sellRes.trade?.pnl
    });
    assert.strictEqual(sellRes.success, true);
    assert.strictEqual(sellRes.trade?.status, 'CLOSED');
    assert.strictEqual(Number(sellRes.trade?.exit_price), 190);
    assert.strictEqual(Number(sellRes.trade?.pnl), 125); // (190 - 185) * 25 = +125
    console.log('  ✔ Position closed with realized P&L = +₹125.00');

    // 7. Verify Status after closure
    const st3 = await fetch(base + '/api/quant/paper/status', { headers }).then(r => r.json());
    console.log('[6] GET /api/quant/paper/status (After SELL):', {
      openPositions: st3.openPositions?.length,
      closedTrades: st3.tradesHistory?.length,
      realizedPnl: st3.tradesHistory?.[0]?.pnl
    });
    assert.strictEqual(st3.openPositions?.length, 0);
    assert.strictEqual(st3.tradesHistory?.length, 1);
    assert.strictEqual(st3.tradesHistory[0].status, 'CLOSED');
    assert.strictEqual(st3.tradesHistory[0].pnl, 125);

    // 8. Verify Absolute Dhan Broker Isolation
    const liveOrders = await pool.query("SELECT COUNT(id)::int AS count FROM algo_orders WHERE user_id = $1 AND execution_mode = 'LIVE'", [userId]);
    console.log('[7] Dhan Live Orders Placed:', liveOrders.rows[0].count);
    assert.strictEqual(liveOrders.rows[0].count, 0);
    console.log('  ✔ Zero Dhan live orders placed. Complete broker isolation confirmed!');

    // 9. Stop Engine
    const stopRes = await fetch(base + '/api/quant/paper/stop', { method: 'POST', headers }).then(r => r.json());
    console.log('[8] POST /api/quant/paper/stop:', stopRes);
    assert.strictEqual(stopRes.status, 'STOPPED');

    console.log('\n================================================================');
    console.log('  ✅ ALL 8 PAPER TRADING LIFECYCLE STEPS VERIFIED WITH 100% SUCCESS');
    console.log('================================================================');
  } finally {
    server.close();
  }
}

runTest().then(() => process.exit(0)).catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
