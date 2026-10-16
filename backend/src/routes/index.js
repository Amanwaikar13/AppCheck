import { Router } from 'express';
import { APP_NAME } from '../services/health.service.js';
import { createAuthRouter } from './auth.routes.js';
import healthRoutes from './health.routes.js';
import { API_PREFIX } from './prefix.js';
import { createScanRouter, createScannerRouter } from './scan.routes.js';

export { API_PREFIX };

export function createApiRouter(config) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json({
      name: APP_NAME,
      version: 'v1',
      endpoints: {
        health: `${API_PREFIX}/health`,
        register: `${API_PREFIX}/auth/register`,
        login: `${API_PREFIX}/auth/login`,
        logout: `${API_PREFIX}/auth/logout`,
        me: `${API_PREFIX}/auth/me`,
        scans: `${API_PREFIX}/scans`,
        scannerStatus: `${API_PREFIX}/scanner/status`,
      },
    });
  });

  router.use('/health', healthRoutes);
  router.use('/auth', createAuthRouter(config.authRateLimits));
  router.use('/scans', createScanRouter(config.scanRateLimits));
  router.use('/scanner', createScannerRouter());

  return router;
}
