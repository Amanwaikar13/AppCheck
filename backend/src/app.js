import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { API_PREFIX, createApiRouter } from './routes/index.js';
import { CSRF_HEADER, csrfProtection } from './middleware/csrf.js';
import { notFound } from './middleware/notFound.js';
import { createApiRateLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { resolveTarget } from './scanner/targetPolicy.js';

const SCANNER_DISABLED = Object.freeze({
  enabled: false,
  available: false,
  reason: 'The URL scanner is disabled on this server',
});

/**
 * Builds the Express application. It does not open a port, connect to the
 * database, or start the scan worker; server.js owns startup so the app can be
 * tested in isolation. `services` lets tests replace DNS resolution and the
 * scanner status source.
 */
export function createApp({ config, logger, services = {} }) {
  const app = express();
  app.locals.config = config;
  app.locals.services = {
    resolveTarget: services.resolveTarget ?? ((url) => resolveTarget(url)),
    scannerStatus: services.scannerStatus ?? (() => SCANNER_DISABLED),
  };

  app.disable('x-powered-by');

  // req.ip (used by rate limits and logs) honors X-Forwarded-For only when
  // TRUST_PROXY describes the real proxy chain. Off by default: the API is
  // reached directly, and trusting the header then would let any client spoof
  // its IP and bypass per-IP limits.
  if (config.trustProxy !== false && config.trustProxy !== undefined) {
    app.set('trust proxy', config.trustProxy);
  }

  app.use(pinoHttp({ logger }));
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins,
      // Credentialed CORS: only the explicit allowlist (never "*") may send the session cookie.
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', CSRF_HEADER],
      // Lets the frontend read when a rate-limited request may be retried.
      exposedHeaders: ['Retry-After', 'RateLimit', 'RateLimit-Policy'],
      maxAge: 600,
    })
  );
  app.use(express.json({ limit: '100kb' }));

  // Global limit: per user for valid sessions, per IP otherwise (see middleware/rateLimit.js).
  app.use(API_PREFIX, createApiRateLimiter(config));

  app.use(API_PREFIX, csrfProtection({ allowedOrigins: config.corsOrigins }));
  app.use(API_PREFIX, createApiRouter(config));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
