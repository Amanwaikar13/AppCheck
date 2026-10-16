import { ApiError } from '../utils/ApiError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const CSRF_HEADER = 'X-Requested-With';
export const CSRF_HEADER_VALUE = 'XMLHttpRequest';

/**
 * CSRF protection for cookie-authenticated, state-changing requests:
 *  1. If the browser sent an Origin header, it must be an allowed frontend origin.
 *  2. The request must carry `X-Requested-With: XMLHttpRequest`. Browsers cannot
 *     add custom headers cross-origin without a CORS preflight, which only the
 *     allowed origins pass, so a forged form/navigation request cannot satisfy it.
 * Requests authenticated with an Authorization header are exempt from (2):
 * browsers never attach that header automatically, so they are not forgeable.
 */
export function csrfProtection({ allowedOrigins }) {
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();

    const origin = req.get('origin');
    if (origin && !allowedOrigins.includes(origin)) {
      return next(new ApiError(403, 'CSRF_REJECTED', 'Request origin is not allowed'));
    }

    if (req.get('authorization')) return next();

    if (req.get(CSRF_HEADER) !== CSRF_HEADER_VALUE) {
      return next(
        new ApiError(403, 'CSRF_REJECTED', `Missing required header ${CSRF_HEADER}: ${CSRF_HEADER_VALUE}`)
      );
    }
    next();
  };
}
