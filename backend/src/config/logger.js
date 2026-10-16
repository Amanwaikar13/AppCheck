import pino from 'pino';

// Paths whose values must never be written to logs.
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'req.body',
  '*.password',
  '*.passwordHash',
  '*.currentPassword',
  '*.newPassword',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.secret',
  '*.jwt',
  '*.jwtSecret',
  '*.JWT_SECRET',
  '*.mongodbUri',
  '*.MONGODB_URI',
  '*.*.password',
  '*.*.passwordHash',
  '*.*.token',
];

/** `destination` is optional (defaults to stdout); tests pass a capturing stream. */
export function createLogger({ logLevel = 'info' } = {}, destination) {
  return pino(
    {
      name: 'appcheck-api',
      level: logLevel,
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    },
    destination
  );
}
