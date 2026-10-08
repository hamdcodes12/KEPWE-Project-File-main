# Angel One SmartAPI integration (KEPWE Quant)

Angel One SmartAPI is the only broker KEPWE Quant supports.

## What you need

| Item | Where it comes from | Where it goes |
|---|---|---|
| SmartAPI app API key | smartapi.angelone.in -> My Apps (Trading API) | `ANGEL_ONE_API_KEY` on the server, or entered per user on the Broker screen |
| Client code | Angel One account | Broker screen (stored) |
| MPIN | Angel One account | Broker screen (never stored) |
| TOTP | Authenticator app, after "Enable TOTP" on smartapi.angelone.in | Broker screen (never stored) |
| Static IP | Registered against the SmartAPI app (required by SEBI for order APIs) | `ANGEL_ONE_STATIC_IP` - must equal the server's egress IP |
| Token encryption key | 32-byte secret you generate | `BROKER_TOKEN_ENCRYPTION_KEY` |
| NIFTY freeze quantity | Current NSE circular | `ANGEL_ONE_NIFTY_FREEZE_QTY` (unset blocks order sizing) |

Optional: `ANGEL_ONE_REDIRECT_URL` (publisher/redirect login), `ANGEL_ONE_WEBHOOK_TOKEN`
(postback URL secret), and operator auto re-login `ANGEL_ONE_CLIENT_CODE`,
`ANGEL_ONE_MPIN`, `ANGEL_ONE_TOTP_SECRET`. See `.env.example`.

## Endpoints used

loginByPassword, generateTokens, logout, getProfile, getRMS, placeOrder, modifyOrder,
cancelOrder, getOrderBook, getTradeBook, order details, getPosition, getHolding,
getAllHolding, market quote, getCandleData, optionGreek, and the public scrip master.

## Session handling

Tokens are encrypted at rest. On a session-expired response one refresh is attempted
and the call retried once; if that fails the account is marked `SESSION_EXPIRED` and
the user must sign in again. Order placement/modify/cancel and login are never retried.
Invalid broker credentials return HTTP 422 so the KEPWE login is not affected.

## Verifying against the real API

Unit tests (`npm run test:broker`) use a local wire-format server and prove nothing
about the live API. To test the real flow, from `backend/`:

```
ANGEL_ONE_API_KEY=... ANGEL_ONE_CLIENT_CODE=... ANGEL_ONE_MPIN=... ANGEL_ONE_TOTP=123456 \
  node scripts/angel-one-live-verify.mjs --negative
```

(`ANGEL_ONE_TOTP_SECRET` may replace `ANGEL_ONE_TOTP`.) It is read-only by default and
writes `angel-one-live-verify-report.json`. `--order-test` additionally places, modifies and
cancels one REAL 1-share far-from-market limit order; it needs the static IP registered and
`ANGEL_ONE_STATIC_IP` set, and should only be run deliberately during market hours.

Then run `node production-readiness-check.js <user-id>` for the per-user gate check.
