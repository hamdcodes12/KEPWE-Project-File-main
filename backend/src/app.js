import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { logServerError } from './lib/safe-logger.js';
import authRoutes from './routes/auth.routes.js';
import plansRoutes from './routes/plans.routes.js';
import companiesRoutes from './routes/companies.routes.js';
import leadsRoutes from './routes/leads.routes.js';
import contactRoutes from './routes/contact.routes.js';
import complianceRoutes from './routes/compliance.routes.js';
import workflowRoutes from './routes/workflow.routes.js';
import checklistRoutes from './routes/checklist.routes.js';
import portalRoutes from './routes/portal.routes.js';
import businessOnboardingRoutes from './routes/business-onboarding.routes.js';
import adminRoutes from './routes/admin.routes.js';
import riskProfileRoutes from './routes/risk-profile.routes.js';
import tradeJournalRoutes from './routes/trade-journal.routes.js';
import alertsRoutes from './routes/alerts.routes.js';
import paperTradeRoutes from './routes/paper-trade.routes.js';
import subscriptionRoutes from './routes/subscription.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import marketDataRoutes from './routes/market-data.routes.js';
import adminPanelRoutes from './routes/admin-panel.routes.js';
import supportRoutes from './routes/support.routes.js';
import algoRoutes from './routes/algo.routes.js';
import brokerOAuthRoutes from './routes/broker-oauth.routes.js';
import kycRoutes from './routes/kyc.routes.js';
import ledgerRoutes from './routes/ledger.routes.js';
import { pool } from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (3 levels up: src/app.js -> backend -> root)
dotenv.config({ path: resolve(__dirname, '../../.env') });
dotenv.config();

const app = express();

const isProduction = process.env.NODE_ENV === 'production';

// Render (and most PaaS providers) terminate TLS at a reverse proxy in front
// of the app. Without this, req.protocol / req.secure / rate-limit IP
// detection would be wrong, and `secure` cookies (if ever added) wouldn't work.
app.set('trust proxy', 1);

// ── Security Headers ────────────────────────────────────────────────
// CSP is scoped to what this app actually needs: Google Fonts (used in
// index.html) plus same-origin scripts/styles/images (the built SPA is
// served from this same Express app in production).
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://*.razorpay.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://*.razorpay.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://*.razorpay.com'],
        connectSrc: ["'self'", 'https://checkout.razorpay.com', 'https://api.razorpay.com', 'https://*.razorpay.com'],
        frameSrc: ["'self'", 'https://checkout.razorpay.com', 'https://api.razorpay.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  })
);
app.use(compression());

// ── CORS ─────────────────────────────────────────────────────────────
// In this deployment, the frontend and backend are served from the SAME
// Render service/origin, so same-origin requests never send a CORS
// "Origin" header restriction issue in the first place. CORS_ORIGINS only
// needs to be set if the frontend is ever split out to its own domain
// (e.g. a separate static site) — in that case list its exact origin(s),
// comma-separated, e.g. "https://kepwe.com,https://www.kepwe.com".
const configuredOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const localDevelopmentOrigins = isProduction
  ? []
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];
const allowedOrigins = isProduction
  ? configuredOrigins
  : [...new Set([...configuredOrigins, ...localDevelopmentOrigins])];

// Same-origin requests do not need CORS. Skipping the middleware in that
// mode is important because browser asset requests can include an Origin
// header and must never be turned into a 403 JSON response.
if (allowedOrigins.length > 0) {
  app.use(
    cors({
      origin(origin, callback) {
        let normalizedOrigin = origin;
        try {
          normalizedOrigin = origin ? new URL(origin).origin : origin;
        } catch {
          normalizedOrigin = origin;
        }
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes(normalizedOrigin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    })
  );
}

// Document uploads are sent as base64 JSON so the API can persist the file
// bytes alongside their user-scoped metadata. Keep the request limit bounded.
app.use(express.json({ limit: '8mb' }));
app.use((req, res, next) => {
  req.requestId = req.get('x-request-id') || crypto.randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
});

// ── Frontend static assets (single-service deployment) ──────────────
// The Render build command runs `npm run build` at the project root,
// producing a `dist/` folder (Vite output) next to `backend/`. This
// Express app serves that folder directly so the frontend and backend
// run as ONE Render web service on ONE port — no separate static site,
// no cross-origin requests, no CORS configuration needed in production.
const distPath = resolve(__dirname, '../../dist');
const distIndexHtml = join(distPath, 'index.html');
const distExists = fs.existsSync(distIndexHtml);

if (distExists) {
  app.use(
    express.static(distPath, {
      index: false, // never auto-serve index.html for directory requests; the SPA fallback below handles that
      maxAge: isProduction ? '1y' : 0,
      immutable: isProduction,
    })
  );
} else {
  console.warn(
    `[server] No built frontend found at ${distPath}. Run "npm run build" at the project root before starting in production. API-only mode.`
  );
}

// ── Rate limiting ───────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

app.use('/api/auth', authLimiter);

// ── Routes ──────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api', plansRoutes);
app.use('/api', companiesRoutes);
app.use('/api', leadsRoutes);
app.use('/api', contactRoutes);
app.use('/api', complianceRoutes);
app.use('/api', workflowRoutes);
app.use('/api', checklistRoutes);
app.use('/api', portalRoutes);
app.use('/api', businessOnboardingRoutes);
app.use('/api', adminRoutes);
app.use('/api', riskProfileRoutes);
app.use('/api', tradeJournalRoutes);
app.use('/api', alertsRoutes);
app.use('/api', paperTradeRoutes);
app.use('/api', subscriptionRoutes);
app.use('/api', reportsRoutes);
app.use('/api', notificationsRoutes);
app.use('/api', marketDataRoutes);
app.use('/api', adminPanelRoutes);
app.use('/api', supportRoutes);
// Must precede algoRoutes: the Lemonn OAuth callback is public by design,
// while all user-facing /broker and /algo routes remain protected there.
app.use('/api', brokerOAuthRoutes);
app.use('/api', algoRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api', ledgerRoutes);

// ── Health check ────────────────────────────────────────────────────
// Used by Render's health check probe to determine if the service is up.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'kepwe-backend', timestamp: new Date().toISOString() });
});

app.get('/api/health/db', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'reachable' });
  } catch (err) {
    next(err);
  }
});

// ── 404 for unmatched API routes ─────────────────────────────────────
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── SPA fallback (single-service deployment) ─────────────────────────
// Any non-API GET request (client-side routes like /pricing, /login,
// /app/dashboard, etc.) returns the built index.html so React Router can
// take over. This must be registered AFTER all /api routes and the static
// asset middleware above.
if (distExists) {
  app.get('*', (req, res) => {
    res.sendFile(distIndexHtml);
  });
} else {
  app.use((req, res) => {
    res.status(404).json({ error: 'Frontend build not found. Run "npm run build" first.' });
  });
}

// ── Central error handler ───────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS origin not allowed' });
  }
  logServerError('request.failed', err, req);
  res.status(err.statusCode || 500).json({ error: 'Internal server error', requestId: req.requestId });
});

export default app;
