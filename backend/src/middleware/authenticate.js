import mongoose from 'mongoose';
import { isDatabaseReady } from '../config/database.js';
import { User } from '../models/User.js';
import { verifyAccessToken } from '../services/token.service.js';
import { ApiError } from '../utils/ApiError.js';
import { SESSION_COOKIE, readCookie } from '../utils/sessionCookie.js';

const BEARER = /^Bearer\s+(\S+)$/i;

/**
 * Finds the session token: an `Authorization: Bearer` header (API clients)
 * takes precedence over the HttpOnly session cookie (browser).
 */
export function extractToken(req) {
  const header = req.get('authorization');
  if (header) {
    const match = BEARER.exec(header);
    return match ? { token: match[1], source: 'bearer' } : { token: null, source: 'bearer' };
  }
  const cookie = readCookie(req, SESSION_COOKIE);
  return cookie ? { token: cookie, source: 'cookie' } : { token: null, source: null };
}

/** Verifies a token and returns its claims, or throws a 401 ApiError. */
export function verifyTokenOrThrow(token, config) {
  try {
    return verifyAccessToken(token, config.jwt);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'TOKEN_EXPIRED', 'Your session has expired. Please sign in again.');
    }
    throw new ApiError(401, 'INVALID_TOKEN', 'Authentication token is invalid');
  }
}

/**
 * Requires a valid session. Token checks run before any database access, then
 * the user is loaded so deleted accounts, role changes, and revoked sessions
 * (tokenVersion) take effect immediately. Sets req.user and req.authSource.
 */
export async function authenticate(req, _res, next) {
  const { token, source } = extractToken(req);
  if (!token) {
    throw new ApiError(
      401,
      source === 'bearer' ? 'INVALID_TOKEN' : 'AUTH_REQUIRED',
      source === 'bearer' ? 'Authorization header must be "Bearer <token>"' : 'Authentication required'
    );
  }

  const claims = verifyTokenOrThrow(token, req.app.locals.config);
  if (!mongoose.isValidObjectId(claims.sub)) {
    throw new ApiError(401, 'INVALID_TOKEN', 'Authentication token is invalid');
  }

  if (!isDatabaseReady()) {
    throw new ApiError(
      503,
      'DATABASE_UNAVAILABLE',
      'The database is temporarily unavailable. Please try again shortly.'
    );
  }

  const user = await User.findById(claims.sub).select('+tokenVersion');
  if (!user || user.tokenVersion !== claims.ver) {
    throw new ApiError(401, 'INVALID_TOKEN', 'Your session is no longer valid. Please sign in again.');
  }

  req.user = user;
  req.authSource = source;
  next();
}
