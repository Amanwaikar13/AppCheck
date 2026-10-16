import { isDatabaseReady } from '../config/database.js';
import { ApiError } from '../utils/ApiError.js';

/** Fails fast with 503 instead of letting queries hang while the database is down. */
export function requireDatabase(_req, _res, next) {
  if (!isDatabaseReady()) {
    return next(
      new ApiError(
        503,
        'DATABASE_UNAVAILABLE',
        'The database is temporarily unavailable. Please try again shortly.'
      )
    );
  }
  next();
}
