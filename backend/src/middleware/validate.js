import { ApiError } from '../utils/ApiError.js';

/** Field paths and messages only, never submitted values. */
function toDetails(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || (issue.keys ? issue.keys.join(', ') : ''),
    message: issue.message,
  }));
}

/**
 * Validates req.body against a Zod schema and replaces it with the parsed value.
 * Error details list field paths and messages only, never submitted values.
 */
export function validateBody(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      return next(new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', toDetails(result.error)));
    }
    req.body = result.data;
    next();
  };
}

/**
 * Validates req.query or req.params. Express 5 makes req.query read-only, so the
 * parsed value is stored on req.validated.query / req.validated.params instead.
 */
function validateSource(source, message) {
  return (schema) => (req, _res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      return next(new ApiError(400, 'VALIDATION_ERROR', message, toDetails(result.error)));
    }
    req.validated = { ...req.validated, [source]: result.data };
    next();
  };
}

export const validateQuery = validateSource('query', 'Invalid query parameters');
export const validateParams = validateSource('params', 'Invalid path parameters');
