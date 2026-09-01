import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, validateBody } from '../middleware/auth.js';
import { registerUser, loginUser } from '../services/auth.service.js';
import { refreshSession, logoutUser, getAuthUserProfile } from '../services/auth.session.service.js';
import { logServerError } from '../lib/safe-logger.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(255, 'Name is too long'),
  email: z.string().trim().max(255, 'Email is too long').email('Enter a valid email address'),
  mobile: z.string().trim().regex(/^\+?[0-9\s-]{10,15}$/, 'Enter a valid mobile number'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password is too long'),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Email or mobile is required').max(255, 'Email or mobile is too long'),
  password: z.string().min(1, 'Password is required').max(128, 'Password is too long'),
  rememberMe: z.boolean().optional().default(false),
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
      },
      getReqInfo(req)
    );
    return res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode === 401 || err.statusCode === 403) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    logServerError('auth.login.failed', err, req);
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

router.get('/me', requireAuth, async (req, res, next) => {
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

export default router;
