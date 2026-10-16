// Changes an existing user's role. Admins can only be created this way (there is
// no public admin registration). Requires direct database access via backend/.env.
//
//   npm run user:set-role -- someone@example.com admin
//
// Changing a role also revokes the user's existing sessions.
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/config/logger.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { USER_ROLES, User } from '../src/models/User.js';

const [email, role] = process.argv.slice(2);

if (!email || !USER_ROLES.includes(role)) {
  console.error(`Usage: npm run user:set-role -- <email> <${USER_ROLES.join('|')}>`);
  process.exit(1);
}

const config = loadEnv();
const logger = createLogger({ logLevel: 'warn' });

try {
  await connectDatabase(config.mongodbUri, logger, { dnsServers: config.dnsServers });
  const user = await User.findOneAndUpdate(
    { email: email.trim().toLowerCase() },
    { $set: { role }, $inc: { tokenVersion: 1 } },
    { new: true }
  );
  if (!user) {
    console.error(`No user found with email ${email}`);
    process.exitCode = 1;
  } else {
    console.log(`${user.email} is now "${user.role}". Their existing sessions were signed out.`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
