import { z } from 'zod';
import { MAX_TARGET_LENGTH, SCAN_STATUSES, SCAN_TYPES } from '../models/Scan.js';
import { describeBlockedHost } from '../utils/networkTarget.js';

export const PROJECT_NAME_MAX_LENGTH = 100;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_PAGE = 1000;

/** Fields the history endpoint may sort by. "-field" sorts descending. */
export const SCAN_SORT_FIELDS = Object.freeze(['createdAt', 'target', 'type', 'status']);
export const SCAN_SORT_OPTIONS = Object.freeze(
  SCAN_SORT_FIELDS.flatMap((field) => [field, `-${field}`])
);
export const DEFAULT_SCAN_SORT = '-createdAt';

const requiredString = (label) =>
  z.string({
    error: (issue) => (issue.input === undefined ? `${label} is required` : `${label} must be a string`),
  });

// Raw whitespace or control characters are never valid in a URL; they are
// rejected rather than silently percent-encoded or stripped by the parser.
const WHITESPACE_OR_CONTROL = /[\s\u0000-\u001f\u007f]/;

/**
 * Parses and normalizes a URL scan target. Rejects anything that is not a plain
 * http(s) URL to a public host: other schemes, embedded credentials, local or
 * private addresses, and internal hostnames. The stored value is the
 * normalized URL without its #fragment (fragments never reach a server).
 */
const scanUrl = requiredString('URL')
  .trim()
  .min(1, 'URL is required')
  .max(MAX_TARGET_LENGTH, `URL must be at most ${MAX_TARGET_LENGTH} characters`)
  .transform((value, ctx) => {
    const fail = (message) => {
      ctx.addIssue({ code: 'custom', message });
      return z.NEVER;
    };

    if (WHITESPACE_OR_CONTROL.test(value)) {
      return fail('URL must not contain spaces or control characters');
    }

    let url;
    try {
      url = new URL(value);
    } catch {
      return fail('Enter a valid URL, e.g. https://example.com');
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return fail('URL must start with http:// or https://');
    }
    if (url.username || url.password) {
      return fail('URL must not contain a username or password');
    }
    if (!url.hostname) {
      return fail('URL must include a host name');
    }

    const blocked = describeBlockedHost(url);
    if (blocked) return fail(blocked);

    url.hash = '';
    if (url.href.length > MAX_TARGET_LENGTH) {
      return fail(`URL must be at most ${MAX_TARGET_LENGTH} characters`);
    }
    return url.href;
  });

/**
 * A human-readable project name or identifier such as "payments-api" or
 * "acme/web frontend": letters, digits, spaces, and . _ - / only. It is a
 * label, never used as a file path, but path-like sequences are rejected anyway.
 */
const projectName = requiredString('Project name')
  .trim()
  .transform((value) => value.replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(1, { message: 'Project name is required', abort: true })
      .max(
        PROJECT_NAME_MAX_LENGTH,
        `Project name must be at most ${PROJECT_NAME_MAX_LENGTH} characters`
      )
      .regex(/^[A-Za-z0-9 ._/-]+$/, 'Project name may contain only letters, numbers, spaces, and . _ - /')
      .regex(/^[A-Za-z0-9]/, 'Project name must start with a letter or number')
      .refine((value) => !value.includes('..'), 'Project name must not contain ".."')
      .refine((value) => !/\/\/|\/$| \/|\/ /.test(value), 'Project name has a misplaced "/"')
  );

// Strict objects: a client-supplied userId, status, securityScore,
// findingsCount, timestamp, or any other field is rejected with 400.
export const createUrlScanSchema = z.strictObject({ url: scanUrl });
export const createSourceScanSchema = z.strictObject({ projectName });

// Query values arrive as strings; a repeated key arrives as an array and fails.
function wholeNumber(name, max, fallback) {
  return z
    .string({ error: `${name} must be a whole number` })
    .regex(/^\d{1,6}$/, `${name} must be a whole number`)
    .transform(Number)
    .pipe(
      z
        .number()
        .int()
        .min(1, `${name} must be at least 1`)
        .max(max, `${name} must be at most ${max}`)
    )
    .default(fallback);
}

export const listScansQuerySchema = z.strictObject({
  page: wholeNumber('page', MAX_PAGE, 1),
  limit: wholeNumber('limit', MAX_PAGE_SIZE, DEFAULT_PAGE_SIZE),
  type: z.enum(SCAN_TYPES, { error: `type must be one of: ${SCAN_TYPES.join(', ')}` }).optional(),
  status: z
    .enum(SCAN_STATUSES, { error: `status must be one of: ${SCAN_STATUSES.join(', ')}` })
    .optional(),
  sort: z
    .enum(SCAN_SORT_OPTIONS, { error: `sort must be one of: ${SCAN_SORT_OPTIONS.join(', ')}` })
    .default(DEFAULT_SCAN_SORT),
});

// Exactly 24 hex characters. mongoose.isValidObjectId() also accepts any
// 12-character string, which is not a meaningful scan ID.
export const scanIdParamsSchema = z.strictObject({
  id: z.string().regex(/^[a-f0-9]{24}$/i, 'Scan ID must be a 24-character hexadecimal ID'),
});
