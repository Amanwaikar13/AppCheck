import { API_PREFIX } from '../routes/prefix.js';

export const SESSION_COOKIE = 'appcheck_session';

function cookieOptions(config) {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'strict',
    path: API_PREFIX,
  };
}

export function setSessionCookie(res, token, config) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(config), maxAge: config.jwt.expiresInMs });
}

export function clearSessionCookie(res, config) {
  res.clearCookie(SESSION_COOKIE, cookieOptions(config));
}

/** Reads one cookie from the Cookie header without a parsing dependency. */
export function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}
