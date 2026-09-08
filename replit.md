# KEPWE Replit setup

## Run configuration

The project uses Node.js 20, matching the React Router dependency requirements.

This project uses two Replit workflows:

- `Start application` runs the Vite frontend on port 5000.
- `Backend API` runs the Express API on port 3001, applies the database migrations, and serves API requests for the frontend proxy.

The protected `/indexpilot-algo` workspace uses the backend auth/session APIs and stores each user's Algo status, risk settings, broker adapter state, positions, trades, and activity log in PostgreSQL. Broker connections are sandbox-only until a production adapter is intentionally configured.

The frontend uses `/api` by default and Vite proxies those requests to `http://localhost:3001` during development. The production build is also configured for the backend to serve the compiled `dist/` directory from a single service.

For Render, use the included `render.yaml` Blueprint or set the web service build
command to `npm run render-build` and the start command to `npm start`. The Render
build normalizes any Replit-only package tarball URLs in the lockfile and installs
both the frontend and backend from the public npm registry.

The KEPWE QUANT integration-ready workspace is available at `/quant` with deep links for dashboard, markets, watchlist, portfolio, positions, orders, holdings, analytics, strategies, builder, risk, broker, notifications, and settings. Its UI keeps provider-dependent data empty until a real broker adapter is configured; it does not assume Lemonn API endpoints.

## Environment

The backend reads environment variables from Replit Secrets and from a root `.env` file when running locally. `DATABASE_URL` is required for the API and migrations. Authentication uses `JWT_SECRET` when present, or the configured `SESSION_SECRET`; production requires one strong value. Razorpay payment operations require both the backend-only `RAZORPAY_KEY_SECRET` and the public `RAZORPAY_KEY_ID`/`VITE_RAZORPAY_KEY_ID`. IndexPilot live market data uses `UPSTOX_ACCESS_TOKEN`. Client-side API routing uses `VITE_API_BASE_URL`.

## Useful commands

```bash
npm run build
npm run dev -- --host 0.0.0.0 --port 5000
npm start --prefix backend
npm run migrate
npm test --prefix backend
```

The backend test command covers authentication, user isolation, API smoke checks,
and the IndexPilot algo engine. Razorpay integration tests are skipped when the
backend-only `RAZORPAY_KEY_SECRET` secret is not configured; payment verification
remains fail-closed until that secret is available.