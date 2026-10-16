import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { login, logout, me, register } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { rateLimitExceeded } from '../middleware/rateLimit.js';
import { requireDatabase } from '../middleware/requireDatabase.js';
import { validateBody } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../validators/auth.validators.js';

export const DEFAULT_AUTH_RATE_LIMITS = Object.freeze({
  windowMs: 15 * 60 * 1000,
  // Failed login attempts per IP per window (successful logins are not counted).
  login: 10,
  // Registration attempts per IP per window.
  register: 5,
});

function limiter(name, windowMs, limit, options = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: rateLimitExceeded(name, 'Too many attempts. Please try again later.'),
    ...options,
  });
}

/** Rate limiters are created per app, so each instance (and test) has its own counters. */
export function createAuthRouter(overrides = {}) {
  const limits = { ...DEFAULT_AUTH_RATE_LIMITS, ...overrides };
  const router = Router();

  router.post(
    '/register',
    limiter('register', limits.windowMs, limits.register),
    validateBody(registerSchema),
    requireDatabase,
    register
  );
  router.post(
    '/login',
    // Only failed attempts count (any response >= 400); successful sign-ins are refunded.
    limiter('login', limits.windowMs, limits.login, { skipSuccessfulRequests: true }),
    validateBody(loginSchema),
    requireDatabase,
    login
  );
  router.post('/logout', logout);
  router.get('/me', authenticate, me);

  return router;
}
