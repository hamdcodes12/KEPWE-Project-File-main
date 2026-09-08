import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { requireAuth, validateBody } from '../middleware/auth.js';
import { registerUser, loginUser, registerVerifiedEmailUser, loginWithVerifiedEmail, serializeUser } from '../services/auth.service.js';
import { refreshSession, logoutUser, getAuthUserProfile } from '../services/auth.session.service.js';
import { consumeEmailOtp, requestEmailOtp } from '../services/email-otp.service.js';
import {
  canonicalizeProduct,
  hasProductAccess,
  grantProductMembership,
  getUserProductKeys
} from '../services/product-membership.service.js';
import { pool } from '../config/db.js';
import { logServerError } from '../lib/safe-logger.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(255, 'Name is too long'),
  email: z.string().trim().max(255, 'Email is too long').email('Enter a valid email address'),
  mobile: z.string().trim().regex(/^\+?[0-9\s-]{10,15}$/, 'Enter a valid mobile number'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password is too long'),
  product: z.string().trim().optional().nullable(),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Email or mobile is required').max(255, 'Email or mobile is too long'),
  password: z.string().min(1, 'Password is required').max(128, 'Password is too long'),
  rememberMe: z.boolean().optional().default(false),
  product: z.string().trim().optional().nullable(),
});

const emailOtpRequestSchema = z.object({
  email: z.string().trim().min(1, 'Email or mobile number is required').max(255, 'Email or mobile number is too long'),
  purpose: z.enum(['login', 'signup']),
  product: z.string().trim().optional().nullable(),
  name: z.string().trim().min(2).max(255).optional(),
  mobile: z.string().trim().regex(/^\+?[0-9\s-]{10,15}$/).optional(),
});

const emailOtpVerifySchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  purpose: z.enum(['login', 'signup']),
  product: z.string().trim().optional().nullable(),
  challengeId: z.string().uuid(),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be a 6-digit number'),
  rememberMe: z.boolean().optional().default(false),
});

const emailOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many email verification attempts. Please try again later.' },
});

const getReqInfo = (req) => ({
  userAgent: req.headers['user-agent'],
  ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null,
});

router.post('/register', validateBody(registerSchema), async (req, res, next) => {
  try {
    const result = await registerUser(
      {
        name: req.validatedBody.name,
        email: req.validatedBody.email,
        password: req.validatedBody.password,
        mobile: req.validatedBody.mobile.replace(/[\s-]/g, ''),
      },
      getReqInfo(req)
    );
    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({ error: err.message });
    }
    logServerError('auth.register.failed', err, req);
    next(err);
  }
});

router.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const result = await loginUser(
      {
        identifier: req.validatedBody.identifier,
        password: req.validatedBody.password,
        rememberMe: req.validatedBody.rememberMe,
        product: req.validatedBody.product || null,
      },
      getReqInfo(req)
    );
    return res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode === 401 || err.statusCode === 403) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    logServerError('auth.login.failed', err, req);
    next(err);
  }
});

router.post('/email-otp/request', emailOtpLimiter, validateBody(emailOtpRequestSchema), async (req, res, next) => {
  try {
    const { email, purpose, name, mobile, product } = req.validatedBody;
    const submittedIdentifier = email.trim();
    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submittedIdentifier);
    const normalizedIdentifier = looksLikeEmail
      ? submittedIdentifier.toLowerCase()
      : submittedIdentifier.replace(/[\s-]/g, '');
    if (!looksLikeEmail && !/^\+?[0-9]{10,15}$/.test(normalizedIdentifier)) {
      return res.status(400).json({ error: 'Enter a valid email address or mobile number.' });
    }
    const canonical = product ? canonicalizeProduct(product) : null;

    const existing = await pool.query(
      looksLikeEmail
        ? 'SELECT id, email, full_name, mobile FROM users WHERE email = $1'
        : 'SELECT id, email, full_name, mobile FROM users WHERE mobile = $1',
      [normalizedIdentifier],
    );
    const existingUser = existing.rows.length > 0;
    const userRow = existingUser ? existing.rows[0] : null;

    if (purpose === 'signup' && !looksLikeEmail) {
      return res.status(400).json({ error: 'Use an email address to create your account.' });
    }

    const normalizedEmail = userRow?.email?.toLowerCase() || normalizedIdentifier;

    if (purpose === 'login') {
      if (!existingUser) {
        return res.status(404).json({ error: 'No KEPWE account exists for this email address.' });
      }
      if (canonical) {
        const hasAccess = await hasProductAccess(userRow.id, canonical);
        if (!hasAccess) {
          return res.status(403).json({
            error: `You do not have a registered account for the ${canonical} workspace. Please create an account for this workspace.`,
            code: 'PRODUCT_MEMBERSHIP_REQUIRED',
            needsSignup: true,
            product: canonical,
          });
        }
      }
    }

    if (purpose === 'signup') {
      if (canonical && existingUser) {
        const hasAccess = await hasProductAccess(userRow.id, canonical);
        if (hasAccess) {
          return res.status(409).json({
            error: `You already have an active account for the ${canonical} workspace. Please sign in instead.`,
            code: 'ALREADY_MEMBER',
            product: canonical,
          });
        }
      } else if (!canonical && existingUser) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }

      if (!existingUser && (!name || !mobile)) {
        return res.status(400).json({ error: 'Name and mobile number are required for signup.' });
      }
    }

    const payload = purpose === 'signup'
      ? {
          product: canonical || null,
          existingUserId: existingUser ? userRow.id : null,
          name: name ? name.trim() : (userRow?.full_name || ''),
          mobile: mobile ? mobile.replace(/[\s-]/g, '') : (userRow?.mobile || ''),
        }
      : { product: canonical || null };

    const challenge = await requestEmailOtp({
      email: normalizedEmail,
      purpose,
      payload,
    });
    return res.json({ success: true, email: normalizedEmail, ...challenge });
  } catch (err) {
    if (err.statusCode) {
      const response = { error: err.message };
      if (err.code) response.code = err.code;
      if (err.retryAfterSeconds) response.retryAfterSeconds = err.retryAfterSeconds;
      return res.status(err.statusCode).json(response);
    }
    return next(err);
  }
});

router.post('/email-otp/verify', emailOtpLimiter, validateBody(emailOtpVerifySchema), async (req, res, next) => {
  try {
    const { email, purpose, challengeId, otp, rememberMe, product } = req.validatedBody;
    const challenge = await consumeEmailOtp({ challengeId, email, purpose, otp });
    const payload = challenge.payload || {};
    const targetProduct = payload.product || (product ? canonicalizeProduct(product) : null);

    let result;
    if (purpose === 'signup') {
      if (payload.existingUserId && targetProduct) {
        await grantProductMembership(payload.existingUserId, targetProduct, { role: 'owner' });
        result = await loginWithVerifiedEmail(email, rememberMe, getReqInfo(req), targetProduct);
      } else {
        result = await registerVerifiedEmailUser({ ...payload, email, product: targetProduct }, getReqInfo(req));
      }
    } else {
      result = await loginWithVerifiedEmail(email, rememberMe, getReqInfo(req), targetProduct);
    }

    return res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    return next(err);
  }
});

/**
 * GET /api/auth/product-access/:product
 * Verify whether the authenticated user has access to a specific product
 */
router.get('/product-access/:product', requireAuth, async (req, res, next) => {
  try {
    const canonical = canonicalizeProduct(req.params.product);
    if (!canonical) {
      return res.status(400).json({ error: 'Invalid product identifier' });
    }
    const hasAccess = await hasProductAccess(req.userId, canonical);
    const memberships = await getUserProductKeys(req.userId);
    return res.json({
      allowed: hasAccess,
      product: canonical,
      memberships,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/product-membership/activate
 * Explicitly activate or join a product workspace for an existing authenticated user
 */
router.post('/product-membership/activate', requireAuth, validateBody(z.object({ product: z.string().trim().min(1) })), async (req, res, next) => {
  try {
    const canonical = canonicalizeProduct(req.validatedBody.product);
    if (!canonical) {
      return res.status(400).json({ error: 'Invalid product identifier' });
    }
    const membership = await grantProductMembership(req.userId, canonical, { role: 'owner' });
    const memberships = await getUserProductKeys(req.userId);
    return res.json({
      success: true,
      membership,
      memberships,
      product: canonical,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', validateBody(z.object({ refreshToken: z.string().min(1) })), async (req, res, next) => {
  try {
    const result = await refreshSession(req.validatedBody.refreshToken, getReqInfo(req));
    return res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode === 401 || err.statusCode === 403) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/logout', validateBody(z.object({ refreshToken: z.string().min(1) })), async (req, res, next) => {
  try {
    await logoutUser(req.validatedBody.refreshToken);
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get(['/me', '/profile'], requireAuth, async (req, res, next) => {
  try {
    const user = await getAuthUserProfile(req.userId);
    return res.json({ user });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
});

// ── User Profile Photo Endpoints ─────────────────────────────────────────────
const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

function validateImageMagicBytes(buffer, mime) {
  if (!buffer || buffer.length < 12) return false;
  // JPEG: FF D8 FF
  if (mime === 'image/jpeg' && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mime === 'image/png' && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  // GIF: GIF87a or GIF89a
  if (mime === 'image/gif' && buffer.toString('ascii', 0, 4) === 'GIF8') return true;
  // WEBP: RIFF....WEBP
  if (mime === 'image/webp' && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return true;
  return false;
}

const avatarUploadSchema = z.object({
  fileData: z.string().min(1, 'Image file data is required'),
  mimeType: z.string().trim().min(1, 'MIME type is required'),
});

router.post(['/profile/avatar', '/profile/photo'], requireAuth, validateBody(avatarUploadSchema), async (req, res, next) => {
  try {
    const { fileData, mimeType } = req.validatedBody;
    const cleanMime = mimeType.toLowerCase().trim();

    if (!ALLOWED_IMAGE_MIMES.includes(cleanMime)) {
      return res.status(400).json({
        error: 'Invalid file type. Only JPEG, PNG, WEBP, and GIF images are accepted.'
      });
    }

    // Strip optional data URI prefix if present (e.g. data:image/png;base64,...)
    const base64Data = fileData.includes(',') ? fileData.split(',')[1] : fileData;
    const buffer = Buffer.from(base64Data, 'base64');

    if (buffer.length === 0) {
      return res.status(400).json({ error: 'Image file is empty or corrupted.' });
    }

    if (buffer.length > MAX_AVATAR_BYTES) {
      return res.status(400).json({
        error: `Image size exceeds the 5 MB limit (received ${(buffer.length / (1024 * 1024)).toFixed(2)} MB).`
      });
    }

    if (!validateImageMagicBytes(buffer, cleanMime)) {
      return res.status(400).json({
        error: 'File contents do not match a valid image format. Non-image or executable files are rejected.'
      });
    }

    const avatarUrl = `/api/auth/profile/avatar/${req.userId}`;

    const updateRes = await pool.query(
      `UPDATE users
       SET avatar_data = $1,
           avatar_mime = $2,
           avatar_url = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, email, full_name, mobile, role, plan, email_verified, is_active, avatar_url, (avatar_data IS NOT NULL) AS has_avatar`,
      [buffer, cleanMime, avatarUrl, req.userId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const safeUser = serializeUser(updateRes.rows[0]);
    return res.json({
      success: true,
      message: 'Profile photo updated successfully.',
      avatarUrl,
      user: safeUser,
    });
  } catch (err) {
    logServerError('auth.profile.avatar.upload', err, req);
    next(err);
  }
});

router.delete(['/profile/avatar', '/profile/photo'], requireAuth, async (req, res, next) => {
  try {
    const updateRes = await pool.query(
      `UPDATE users
       SET avatar_data = NULL,
           avatar_mime = NULL,
           avatar_url = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, full_name, mobile, role, plan, email_verified, is_active, avatar_url, (avatar_data IS NOT NULL) AS has_avatar`,
      [req.userId]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const safeUser = serializeUser(updateRes.rows[0]);
    return res.json({
      success: true,
      message: 'Profile photo removed successfully.',
      avatarUrl: null,
      user: safeUser,
    });
  } catch (err) {
    logServerError('auth.profile.avatar.delete', err, req);
    next(err);
  }
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.get(['/profile/avatar', '/profile/photo'], requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT avatar_data, avatar_mime
       FROM users
       WHERE id = $1 AND avatar_data IS NOT NULL`,
      [req.userId]
    );

    if (result.rows.length === 0 || !result.rows[0].avatar_data) {
      return res.status(404).json({ error: 'Avatar not found.' });
    }

    const row = result.rows[0];
    res.setHeader('Content-Type', row.avatar_mime || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    return res.send(row.avatar_data);
  } catch (err) {
    next(err);
  }
});

router.get(['/profile/avatar/:userId', '/profile/photo/:userId'], requireAuth, async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!UUID_REGEX.test(userId)) {
      return res.status(400).json({ error: 'Invalid user ID format.' });
    }

    if (req.userId !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: You are not authorized to view this profile photo.' });
    }

    const result = await pool.query(
      `SELECT avatar_data, avatar_mime
       FROM users
       WHERE id = $1 AND avatar_data IS NOT NULL`,
      [userId]
    );

    if (result.rows.length === 0 || !result.rows[0].avatar_data) {
      return res.status(404).json({ error: 'Avatar not found.' });
    }

    const row = result.rows[0];
    res.setHeader('Content-Type', row.avatar_mime || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    return res.send(row.avatar_data);
  } catch (err) {
    next(err);
  }
});

export default router;
