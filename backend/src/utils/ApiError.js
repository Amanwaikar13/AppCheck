/**
 * An error that is safe to report to API clients with the given status and code.
 * `details` (optional) is an array of { path, message } describing invalid fields;
 * it must never contain submitted values.
 */
export class ApiError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    if (details) this.details = details;
  }
}
