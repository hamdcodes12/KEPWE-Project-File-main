console.log('=== TASK #5: OMS ORDER CREATION AND STATUS FLOW ===\n');

console.log('[BLOCKING CHECK] Before OMS is even called:');
console.log('Route: POST /api/broker/orders (line 919)');
console.log('Handler starts at line 921\n');

console.log('Step 1 (line 929-933): getBrokerReadiness check');
console.log('  if (!getBrokerReadiness(order.broker, "LIVE").orderExecutionReady) {');
console.log('    return res.status(503).json({...});  // <-- STOPS HERE');
console.log('  }');
console.log('  Result: HTTP 503, never reaches OMS\n');

console.log('[IF IP WAS CONFIGURED] Order would continue to:\n');

console.log('Step 2 (line 935): Get algo settings');
console.log('  SELECT * FROM algo_settings WHERE user_id = $1\n');

console.log('Step 3 (line 937-939): Call getLiveBroker(req, order.broker)');
console.log('  - Validates broker session (SESSION_EXPIRED check)');
console.log('  - Returns 401 if session expired');
console.log('  - Returns adapter with user credentials\n');

console.log('Step 4 (line 941-975): Risk engine evaluation');
console.log('  - Checks daily loss limit');
console.log('  - Checks max trades per day');
console.log('  - Checks consecutive losses');
console.log('  - Checks position sizing');
console.log('  - If not approved: return 409 with risk.reason\n');

console.log('Step 5 (line 982-1002): createAndSubmitOrder()');
console.log('  const submitted = await createAndSubmitOrder({');
console.log('    pool,');
console.log('    adapter,');
console.log('    userId: req.userId,');
console.log('    strategyId: order.strategyId || null,');
console.log('    executionMode: "LIVE",  // <-- ENFORCED HERE');
console.log('    instrument: order.instrument,');
console.log('    side: order.side,');
console.log('    quantity: order.quantity,');
console.log('    price: effectivePrice,');
console.log('    stopLoss: order.stopLoss,');
console.log('    target,');
console.log('    metadata: { ...order.metadata, broker: order.broker },');
console.log('    brokerAccountId: adapter.brokerAccountId,');
console.log('  });\n');

console.log('[OMS EXECUTION MODE ENFORCEMENT]');
console.log('File: backend/src/algo/oms.js');
console.log('Function: createAndSubmitOrder() at line 248\n');

console.log('Lines 259-261:');
console.log('  if (executionMode !== "LIVE") {');
console.log('    throw new Error(');
console.log('      `KEPWE Quant only supports LIVE execution. Received: ${executionMode}. Paper trading has been completely removed.`');
console.log('    );');
console.log('  }\n');

console.log('[STATUS FLOW] If IP was configured and order reached OMS:\n');

console.log('1. Order created in DB:');
console.log('   INSERT INTO algo_orders WITH status="CREATED"\n');

console.log('2. Advisory lock acquired:');
console.log('   SELECT pg_advisory_xact_lock(hashtextextended($1, 0))\n');

console.log('3. Duplicate check:');
console.log('   SELECT FROM algo_orders WHERE status IN ("CREATED", "SUBMITTED", "PARTIALLY_FILLED")');
console.log('   SELECT FROM algo_positions WHERE status = "OPEN"\n');

console.log('4. Dhan API called:');
console.log('   POST https://api.dhan.co/v2/orders');
console.log('   Body includes: transactionType, exchangeSegment, productType, orderType, securityId, quantity, price\n');

console.log('5. Response from Dhan:');
console.log('   - If successful: brokerOrderId returned, status=SUBMITTED');
console.log('   - If error: BrokerApiError thrown\n');

console.log('6. Webhook callback (async):');
console.log('   POST /api/lemonn/callback from Dhan broker');
console.log('   Triggers: applyExecutionUpdate()');
console.log('   Updates: algo_orders status, creates algo_trades, updates algo_positions\n');

console.log('[CURRENT STATE]');
console.log('✗ Order BLOCKED at: Static IP readiness check (line 929-933)');
console.log('✗ Never reaches: getLiveBroker() for session validation');
console.log('✗ Never reaches: Risk engine evaluation');
console.log('✗ Never reaches: createAndSubmitOrder() OMS call');
console.log('✗ Never reaches: Dhan API');
console.log('✗ Never created in: algo_orders table');
