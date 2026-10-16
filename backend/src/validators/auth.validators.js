import { z } from 'zod';

// bcrypt only uses the first 72 bytes of input, so longer passwords are rejected
// rather than silently truncated.
const MAX_PASSWORD_BYTES = 72;
const MIN_PASSWORD_LENGTH = 10;

const email = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .max(254, 'Email must be at most 254 characters')
  .pipe(z.email({ error: 'Enter a valid email address' }));

const newPassword = z
  .string({ error: 'Password is required' })
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .refine((value) => Buffer.byteLength(value, 'utf8') <= MAX_PASSWORD_BYTES, {
    message: `Password must be at most ${MAX_PASSWORD_BYTES} bytes`,
  });

// Strict objects: unknown keys (e.g. "role") are rejected, never silently applied.
export const registerSchema = z.strictObject({
  name: z
    .string({ error: 'Name is required' })
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  email,
  password: newPassword,
});

export const loginSchema = z.strictObject({
  email,
  // No strength rules on login: just bound the input.
  password: z
    .string({ error: 'Password is required' })
    .min(1, 'Password is required')
    .max(1024, 'Password is too long'),
});
