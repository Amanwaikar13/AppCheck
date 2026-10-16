import { getDatabaseStatus } from '../config/database.js';

export const APP_NAME = 'AppCheck';

/** Builds the health report. The app is only healthy when the database is connected. */
export function getHealthReport(nodeEnv) {
  const database = getDatabaseStatus();

  return {
    name: APP_NAME,
    status: database.connected ? 'healthy' : 'unhealthy',
    database: { status: database.status },
    environment: nodeEnv,
    timestamp: new Date().toISOString(),
  };
}
