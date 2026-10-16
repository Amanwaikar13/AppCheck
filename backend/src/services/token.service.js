import jwt from 'jsonwebtoken';

const ALGORITHM = 'HS256';
export const TOKEN_ISSUER = 'appcheck-api';
export const TOKEN_AUDIENCE = 'appcheck-web';

/** Signs a session token for the user. Claims: sub (user id), ver (token version). */
export function signAccessToken(user, { secret, expiresIn }) {
  return jwt.sign({ ver: user.tokenVersion ?? 0 }, secret, {
    algorithm: ALGORITHM,
    subject: user._id.toString(),
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
    expiresIn,
  });
}

/**
 * Verifies signature, algorithm, issuer, audience, and expiry.
 * Throws jsonwebtoken's TokenExpiredError / JsonWebTokenError on failure.
 */
export function verifyAccessToken(token, { secret }) {
  return jwt.verify(token, secret, {
    algorithms: [ALGORITHM],
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
  });
}
