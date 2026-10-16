import dns from 'node:dns';
import mongoose from 'mongoose';
import { redactConnectionStrings } from '../utils/redact.js';

const READY_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

let listenersAttached = false;

function attachListeners(logger) {
  if (listenersAttached) return;
  listenersAttached = true;

  const { connection } = mongoose;
  connection.on('connected', () => logger.info('MongoDB connected'));
  connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  connection.on('error', (error) =>
    logger.error({ errorName: error.name }, redactConnectionStrings(error.message))
  );
}

/**
 * Points Node's built-in resolver (used by the MongoDB driver for mongodb+srv://
 * SRV/TXT lookups) at the given servers. With no servers, the system defaults stay.
 * Returns the servers Node will actually use.
 */
export function applyDnsServers(dnsServers = []) {
  if (dnsServers.length > 0) dns.setServers(dnsServers);
  return dns.getServers();
}

/**
 * Connects to MongoDB (Atlas) and resolves only once the connection is usable.
 * Rejects with an error whose message has credentials stripped.
 */
export async function connectDatabase(uri, logger, { dnsServers = [], dbName } = {}) {
  attachListeners(logger);

  // Must run before mongoose.connect(), which performs the SRV lookup.
  const activeDnsServers = applyDnsServers(dnsServers);
  logger.info(
    { dnsServers: activeDnsServers, source: dnsServers.length > 0 ? 'DNS_SERVERS' : 'system' },
    'DNS servers for MongoDB lookups'
  );

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10_000,
      appName: 'appcheck-api',
      ...(dbName ? { dbName } : {}),
    });
    // Round-trip to the server so "ready" means the cluster actually answered.
    await mongoose.connection.db.admin().ping();
  } catch (error) {
    const safeError = new Error(
      `Could not connect to MongoDB: ${redactConnectionStrings(error.message)}`
    );
    safeError.name = error.name;
    safeError.dnsServers = activeDnsServers;
    safeError.isDnsError = /query(Srv|Txt)/.test(error.message);
    throw safeError;
  }

  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

/** True when queries can be sent to the database right now. */
export function isDatabaseReady() {
  return mongoose.connection.readyState === 1;
}

/** Returns a non-sensitive description of the current connection state. */
export function getDatabaseStatus() {
  const state = mongoose.connection.readyState;
  return {
    status: READY_STATES[state] ?? 'unknown',
    connected: state === 1,
  };
}
