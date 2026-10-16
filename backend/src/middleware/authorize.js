import { USER_ROLES } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

/** Allows the request only if req.user (set by authenticate) has one of the roles. */
export function requireRole(...roles) {
  for (const role of roles) {
    if (!USER_ROLES.includes(role)) throw new Error(`Unknown role: ${role}`);
  }
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'AUTH_REQUIRED', 'Authentication required'));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action')
      );
    }
    next();
  };
}
