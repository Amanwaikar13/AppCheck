import { ApiError } from '../utils/ApiError.js';

/**
 * Converts any thrown error into a consistent JSON body:
 *   { "error": { "code": "...", "message": "..." } }
 * Unexpected errors are logged in full but reported to the client generically,
 * so stack traces and internal details never leave the server.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
export function errorHandler(err, req, res, next) {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details;

  if (err instanceof ApiError) {
    ({ statusCode, code, message, details } = err);
  } else if (isDatabaseUnavailableError(err)) {
    statusCode = 503;
    code = 'DATABASE_UNAVAILABLE';
    message = 'The database is temporarily unavailable. Please try again shortly.';
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Request body contains invalid JSON';
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large';
  }

  if (statusCode >= 500) {
    req.log?.error({ err }, 'Unhandled request error');
  }

  res.status(statusCode).json({ error: details ? { code, message, details } : { code, message } });
}

const DATABASE_ERROR_NAMES = new Set([
  'MongooseServerSelectionError',
  'MongoServerSelectionError',
  'MongoNetworkError',
  'MongoNotConnectedError',
]);

function isDatabaseUnavailableError(err) {
  return DATABASE_ERROR_NAMES.has(err?.name) || /buffering timed out/i.test(err?.message ?? '');
}
