import { getHealthReport } from '../services/health.service.js';

export function getHealth(req, res) {
  const report = getHealthReport(req.app.locals.config.nodeEnv);

  res
    .status(report.status === 'healthy' ? 200 : 503)
    .set('Cache-Control', 'no-store')
    .json(report);
}
