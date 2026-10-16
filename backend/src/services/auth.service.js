import bcrypt from 'bcrypt';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

const DUPLICATE_KEY = 11000;

function invalidCredentials() {
  return new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
}

// Hash compared against when the email is unknown, so "no such user" and
// "wrong password" take about the same time.
const dummyHashes = new Map();
function getDummyHash(rounds) {
  if (!dummyHashes.has(rounds)) {
    dummyHashes.set(rounds, bcrypt.hash('appcheck-timing-equalizer', rounds));
  }
  return dummyHashes.get(rounds);
}

/** Creates a regular user. The role is never taken from client input. */
export async function registerUser({ name, email, password }, { bcryptSaltRounds }) {
  const passwordHash = await bcrypt.hash(password, bcryptSaltRounds);
  try {
    return await User.create({ name, email, passwordHash, role: 'user' });
  } catch (error) {
    if (error?.code === DUPLICATE_KEY) {
      throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    }
    throw error;
  }
}

/** Returns the user for valid credentials, otherwise throws a generic 401. */
export async function verifyCredentials({ email, password }, { bcryptSaltRounds }) {
  const user = await User.findOne({ email }).select('+passwordHash +tokenVersion');
  if (!user) {
    await bcrypt.compare(password, await getDummyHash(bcryptSaltRounds));
    throw invalidCredentials();
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    throw invalidCredentials();
  }

  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

/** Revokes every session issued with the given token version. */
export async function revokeSessions(userId, tokenVersion) {
  await User.updateOne({ _id: userId, tokenVersion }, { $inc: { tokenVersion: 1 } });
}
