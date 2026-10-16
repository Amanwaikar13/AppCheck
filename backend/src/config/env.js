import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';
import { DURATION_PATTERN, durationToMs } from '../utils/duration.js';
import { DEFAULT_ZAP_OPTIONS } from '../scanner/zapRunner.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce
    .number({ error: 'PORT must be a number' })
    .int('PORT must be an integer')
    .min(1, 'PORT must be between 1 and 65535')
    .max(65535, 'PORT must be between 1 and 65535')
    .default(5000),
  MONGODB_URI: z
    .string({ error: 'MONGODB_URI is required' })
    .trim()
    .min(1, 'MONGODB_URI is required')
    .refine((value) => /^mongodb(\+srv)?:\/\/\S+$/.test(value), {
      message: 'MONGODB_URI must start with mongodb+srv:// or mongodb://',
    })
    .refine((value) => !/[<>]/.test(value), {
      message: 'MONGODB_URI still contains <placeholder> values from .env.example',
    }),
  // Comma-separated list of origins allowed by CORS.
  FRONTEND_URL: z
    .string({ error: 'FRONTEND_URL is required' })
    .trim()
    .min(1, 'FRONTEND_URL is required')
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean))
    .pipe(
      z.array(
        z.url({ protocol: /^https?$/, error: 'FRONTEND_URL must contain http(s) origins' })
      )
    ),
  // Optional comma-separated DNS server IPs used to resolve mongodb+srv:// records.
  // Only needed when Node's resolver cannot reach a DNS server (seen on some Windows setups).
  DNS_SERVERS: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value.split(',').map((ip) => ip.trim()).filter(Boolean) : []))
    .pipe(z.array(z.union([z.ipv4(), z.ipv6()], { error: 'DNS_SERVERS must contain IP addresses' }))),
  // Express "trust proxy" setting. Leave unset when clients reach the API
  // directly. Behind a reverse proxy, set the number of proxy hops (e.g. 1) or
  // the proxy addresses/subnets (e.g. "loopback" or "10.0.0.0/8"), so req.ip is
  // the real client and per-IP rate limits cannot be bypassed by spoofing
  // X-Forwarded-For. "true" (trust everything) is rejected for that reason.
  TRUST_PROXY: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value || value === 'false') return false;
      return /^\d+$/.test(value) ? Number(value) : value;
    })
    .refine((value) => value !== 'true', {
      message: 'TRUST_PROXY=true would trust spoofed X-Forwarded-For headers; use a hop count or proxy addresses',
    })
    .refine((value) => value !== 0, { message: 'TRUST_PROXY hop count must be at least 1 (or leave it unset)' }),
  // URL scanner. "disabled" (default): URL scans are accepted but stay queued.
  // "zap-docker": the in-process worker runs OWASP ZAP baseline scans in Docker.
  URL_SCANNER: z.enum(['disabled', 'zap-docker'], { error: 'URL_SCANNER must be "disabled" or "zap-docker"' }).default('disabled'),
  ZAP_DOCKER_IMAGE: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9._/-]*(:[A-Za-z0-9._-]+)?(@sha256:[a-f0-9]{64})?$/, 'ZAP_DOCKER_IMAGE must be a Docker image reference')
    .default(DEFAULT_ZAP_OPTIONS.image),
  // Interface the per-scan egress proxy listens on, and the name the ZAP
  // container uses to reach it. Defaults suit Docker Desktop.
  SCANNER_PROXY_BIND: z.union([z.ipv4(), z.ipv6()], { error: 'SCANNER_PROXY_BIND must be an IP address' }).default('127.0.0.1'),
  SCANNER_PROXY_HOST: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9.-]+$/, 'SCANNER_PROXY_HOST must be a host name or IPv4 address')
    .default(DEFAULT_ZAP_OPTIONS.proxyHost),
  // DEVELOPMENT ONLY: comma-separated "name.test=IP" pairs that may be scanned
  // even though they are local (e.g. "juice.lab.test=127.0.0.1"). Names must
  // end in .test (reserved, never public DNS). Rejected when NODE_ENV=production.
  SCANNER_LAB_TARGETS: z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      const map = new Map();
      for (const pair of (value ?? '').split(',').map((p) => p.trim()).filter(Boolean)) {
        const match = /^([a-z0-9-]+(?:\.[a-z0-9-]+)*\.test)=(.+)$/i.exec(pair);
        const ip = match?.[2];
        if (!match || !z.union([z.ipv4(), z.ipv6()]).safeParse(ip).success) {
          ctx.addIssue({ code: 'custom', message: 'SCANNER_LAB_TARGETS entries must look like name.test=127.0.0.1' });
          return z.NEVER;
        }
        map.set(match[1].toLowerCase(), ip);
      }
      return map;
    }),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // Secret used to sign session JWTs (HS256). Generate with:
  //   node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
  JWT_SECRET: z
    .string({ error: 'JWT_SECRET is required' })
    .min(32, 'JWT_SECRET must be at least 32 characters')
    .refine((value) => !/[<>]/.test(value), {
      message: 'JWT_SECRET still contains a <placeholder> value from .env.example',
    }),
  // Session lifetime: a whole number followed by s, m, h, or d (e.g. 30m, 1h, 7d).
  JWT_EXPIRES_IN: z
    .string()
    .trim()
    .regex(DURATION_PATTERN, 'JWT_EXPIRES_IN must look like 30m, 1h, or 7d')
    .default('1h'),
  BCRYPT_SALT_ROUNDS: z.coerce
    .number({ error: 'BCRYPT_SALT_ROUNDS must be a number' })
    .int('BCRYPT_SALT_ROUNDS must be an integer')
    .min(10, 'BCRYPT_SALT_ROUNDS must be between 10 and 15')
    .max(15, 'BCRYPT_SALT_ROUNDS must be between 10 and 15')
    .default(12),
});

/**
 * Validates raw environment values and returns a frozen config object.
 * Throws an Error listing every invalid variable. Values are never echoed
 * back in the message so secrets cannot leak into logs.
 */
export function parseEnv(source) {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    // Report only the first problem per variable to keep the message readable.
    const firstIssueByKey = new Map();
    for (const issue of result.error.issues) {
      const key = issue.path[0] ?? 'env';
      if (!firstIssueByKey.has(key)) firstIssueByKey.set(key, issue.message);
    }
    const problems = [...firstIssueByKey].map(([key, message]) => `  - ${key}: ${message}`);
    throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
  }

  const env = result.data;
  if (env.NODE_ENV === 'production' && env.SCANNER_LAB_TARGETS.size > 0) {
    throw new Error(`Invalid environment configuration:\n  - SCANNER_LAB_TARGETS: not allowed when NODE_ENV=production`);
  }
  return Object.freeze({
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.PORT,
    mongodbUri: env.MONGODB_URI,
    dnsServers: env.DNS_SERVERS,
    corsOrigins: env.FRONTEND_URL.map((url) => new URL(url).origin),
    trustProxy: env.TRUST_PROXY,
    logLevel: env.LOG_LEVEL,
    jwt: Object.freeze({
      secret: env.JWT_SECRET,
      expiresIn: env.JWT_EXPIRES_IN,
      expiresInMs: durationToMs(env.JWT_EXPIRES_IN),
    }),
    bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,
    scanner: Object.freeze({
      enabled: env.URL_SCANNER === 'zap-docker',
      proxyBindHost: env.SCANNER_PROXY_BIND,
      labTargets: env.SCANNER_LAB_TARGETS,
      zap: Object.freeze({ ...DEFAULT_ZAP_OPTIONS, image: env.ZAP_DOCKER_IMAGE, proxyHost: env.SCANNER_PROXY_HOST }),
    }),
  });
}

/** Loads backend/.env (if present) into process.env, then validates it. */
export function loadEnv() {
  dotenv.config({ path: path.join(backendRoot, '.env'), quiet: true });
  return parseEnv(process.env);
}
