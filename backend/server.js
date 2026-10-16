import { loadEnv } from './src/config/env.js';
import { createLogger } from './src/config/logger.js';
import { connectDatabase, disconnectDatabase } from './src/config/database.js';
import { createApp } from './src/app.js';
import { Scan } from './src/models/Scan.js';
import { Finding } from './src/models/Finding.js';
import { User } from './src/models/User.js';
import { resolveTarget } from './src/scanner/targetPolicy.js';
import { defaultJobDeps } from './src/scanner/urlScanJob.js';
import { createScanWorker } from './src/scanner/worker.js';

let config;
try {
  config = loadEnv();
} catch (error) {
  // The logger depends on config, so report configuration problems directly.
  console.error(`[appcheck-api] ${error.message}`);
  console.error('[appcheck-api] Copy backend/.env.example to backend/.env and fill in the values.');
  process.exit(1);
}

const logger = createLogger(config);

async function start() {
  logger.info('Connecting to MongoDB...');
  try {
    await connectDatabase(config.mongodbUri, logger, { dnsServers: config.dnsServers });
  } catch (error) {
    logger.fatal(error.message);
    if (error.isDnsError) {
      logger.fatal(
        { dnsServers: error.dnsServers },
        'DNS lookup for the Atlas cluster failed. Set DNS_SERVERS in backend/.env (e.g. 8.8.8.8,1.1.1.1) and restart the backend.'
      );
    } else {
      logger.fatal(
        'Check MONGODB_URI, your Atlas database user credentials, and that your IP is on the Atlas Network Access list.'
      );
    }
    process.exit(1);
  }

  // Build indexes (unique email, scan history) before accepting requests.
  try {
    await Promise.all([User.init(), Scan.init(), Finding.init()]);
  } catch (error) {
    logger.fatal({ errorName: error.name }, `Could not create database indexes: ${error.message}`);
    process.exit(1);
  }

  // Background URL scanner (only does work when URL_SCANNER=zap-docker).
  const { labTargets } = config.scanner;
  if (labTargets.size > 0) {
    logger.warn({ labTargets: [...labTargets.keys()] }, 'SCANNER_LAB_TARGETS is set: these local lab hosts may be scanned');
  }
  const resolve = (url) => resolveTarget(url, { labTargets });
  const worker = createScanWorker({
    scannerConfig: config.scanner,
    logger,
    deps: { ...defaultJobDeps, resolveTarget: resolve },
  });
  await worker.start();

  const app = createApp({ config, logger, services: { resolveTarget: resolve, scannerStatus: worker.getStatus } });
  const server = app.listen(config.port, () => {
    logger.info(
      { port: config.port, environment: config.nodeEnv },
      `AppCheck API ready on port ${config.port}`
    );
  });

  server.on('error', (error) => {
    logger.fatal({ code: error.code }, `HTTP server error: ${error.message}`);
    process.exit(1);
  });

  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await worker.stop();
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
