import mongoose from 'mongoose';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { verifyAccessToken } from '../services/token.service.js';
import { ApiError } from '../utils/ApiError.js';
import { extractToken } from './authenticate.js';

/*
 * Global API rate limit, applied to every /api/v1 request.
 *
 * Anonymous requests (including login and registration) share a per-IP
 * bucket. Requests carrying a valid session token get a per-user bucket
 * instead, so normal signed-in use (session checks, health checks, scan
 * history reads) cannot exhaust the bucket that the login form depends on,
 * and users behind one NAT do not starve each other.
 *
 * The token signature, issuer, audience, and expiry are verified (HMAC, no
 * database access) before it selects a user bucket, so forged tokens cannot
 * mint fresh buckets; they fall back to the per-IP bucket. Revocation is still
 * enforced later by `authenticate`.
 */
export const DEFAULT_API_RATE_LIMITS = Object.freeze({
  windowMs: 15 * 60 * 1000,
  // Per IP, unauthenticated. Unchanged from the original global limit.
  anonymous: 100,
  // Per signed-in user. An app page load costs 2-5 requests (session,
  // health, data) and each filter or page change one more, so this allows
  // sustained heavy use (about 40 requests a minute) while still bounding
  // automated abuse from a single account.
  authenticated: 600,
});

const API_LIMIT_MESSAGE = 'Too many requests, please try again later';

/** Memoized per request: { type: 'user', id } for a valid session token, else { type: 'ip' }. */
function identify(req, config) {
  if (req.rateLimitIdentity) return req.rateLimitIdentity;
  let identity = { type: 'ip' };
  const { token } = extractToken(req);
  if (token) {
    try {
      const { sub } = verifyAccessToken(token, config.jwt);
      if (mongoose.isValidObjectId(sub)) identity = { type: 'user', id: String(sub) };
    } catch {
      // Invalid or expired: counted against the IP.
    }
  }
  req.rateLimitIdentity = identity;
  return identity;
}

/**
 * Handler shared by every limiter: logs a diagnostic (no bodies, cookies, or
 * tokens; pino also redacts those headers) and returns the standard 429 body.
 * express-rate-limit has already set Retry-After and RateLimit headers.
 */
export function rateLimitExceeded(limiterName, message) {
  return (req, _res, next) => {
    const identity = req.rateLimitIdentity ?? { type: 'ip' };
    req.log?.warn(
      {
        rateLimit: {
          limiter: limiterName,
          keyType: identity.type,
          ...(identity.type === 'user' ? { userId: identity.id } : {}),
          limit: req.rateLimit?.limit,
          resetTime: req.rateLimit?.resetTime,
        },
        ip: req.ip,
        method: req.method,
        path: req.originalUrl.split('?')[0],
      },
      `Rate limit exceeded (${limiterName})`
    );
    next(new ApiError(429, 'RATE_LIMITED', message));
  };
}

export function createApiRateLimiter(config) {
  const limits = { ...DEFAULT_API_RATE_LIMITS, ...config.apiRateLimits };
  return rateLimit({
    windowMs: limits.windowMs,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => {
      const identity = identify(req, config);
      return identity.type === 'user' ? `user:${identity.id}` : `ip:${ipKeyGenerator(req.ip ?? '')}`;
    },
    limit: (req) => (identify(req, config).type === 'user' ? limits.authenticated : limits.anonymous),
    handler: rateLimitExceeded('api', API_LIMIT_MESSAGE),
  });
}
