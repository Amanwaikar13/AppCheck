import { isDatabaseReady } from '../config/database.js';
import { extractToken, verifyTokenOrThrow } from '../middleware/authenticate.js';
import { registerUser, revokeSessions, verifyCredentials } from '../services/auth.service.js';
import { signAccessToken } from '../services/token.service.js';
import { clearSessionCookie, setSessionCookie } from '../utils/sessionCookie.js';

function startSession(res, user, config) {
  setSessionCookie(res, signAccessToken(user, config.jwt), config);
  res.set('Cache-Control', 'no-store');
}

export async function register(req, res) {
  const { config } = req.app.locals;
  const user = await registerUser(req.body, config);
  startSession(res, user, config);
  res.status(201).json({ user: user.toSafeProfile() });
}

export async function login(req, res) {
  const { config } = req.app.locals;
  const user = await verifyCredentials(req.body, config);
  startSession(res, user, config);
  res.json({ user: user.toSafeProfile() });
}

/**
 * Always clears the cookie. When the presented token is still valid, its
 * session version is revoked so copies of the token stop working too.
 */
export async function logout(req, res) {
  const { config } = req.app.locals;
  const { token } = extractToken(req);
  if (token && isDatabaseReady()) {
    try {
      const claims = verifyTokenOrThrow(token, config);
      await revokeSessions(claims.sub, claims.ver);
    } catch {
      // Invalid or expired token: nothing to revoke.
    }
  }
  clearSessionCookie(res, config);
  res.set('Cache-Control', 'no-store').status(204).end();
}

export function me(req, res) {
  res.set('Cache-Control', 'no-store').json({ user: req.user.toSafeProfile() });
}
