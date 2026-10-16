# Database — MongoDB Atlas

AppCheck stores data in MongoDB Atlas, accessed only from the backend through Mongoose. Collections: `users` (Phase 3), `scans` (Phase 4, extended in Phase 5), and `findings` (Phase 5).

## Atlas setup

1. **Cluster:** create a cluster (the free M0 tier is fine for development).
2. **Database user:** *Security → Database Access → Add New Database User*. Use password authentication and grant `readWrite` on the `appcheck` database (or "Read and write to any database" for development).
3. **Network access:** *Security → Network Access → Add IP Address*. Add your current public IP. If your IP changes often (mobile/ISP networks), you will need to update this entry; avoid `0.0.0.0/0` except for short-lived testing.
4. **Connection string:** *Database → Connect → Drivers → Node.js*. Copy the `mongodb+srv://` string.

## Configure the backend

In `backend/.env` (never in source code):

```env
MONGODB_URI=mongodb+srv://<db_user>:<db_password>@<cluster-host>/appcheck?retryWrites=true&w=majority
```

- Replace every `<...>` placeholder; startup rejects values still containing `<` or `>`.
- Put the database name (`appcheck`) after the host; otherwise Mongoose uses `test`.
- URL-encode special characters in the password (`@` → `%40`, `:` → `%3A`, `/` → `%2F`, `#` → `%23`).

## How the connection works

`backend/src/config/database.js`:

- If `DNS_SERVERS` is set, `applyDnsServers()` calls Node's built-in `dns.setServers()` **before** `mongoose.connect()`. The MongoDB driver resolves `mongodb+srv://` records with `dns.promises.resolve()`, which uses the same resolver. The servers in use are logged at startup.
- `connectDatabase(uri, logger, { dnsServers })` calls `mongoose.connect` with a 10 s server-selection timeout, then runs an `admin().ping()` so "connected" means the cluster actually answered.
- Errors are re-thrown with credentials stripped from any connection string in the message.
- Connection events (`connected`, `disconnected`, `reconnected`, `error`) are logged.
- `getDatabaseStatus()` maps `mongoose.connection.readyState` to `connected` / `connecting` / `disconnecting` / `disconnected` for the health endpoint.

`server.js` refuses to start the HTTP server until the connection succeeds. There is no in-memory fallback.

## Verifying connectivity

```bash
cd backend
npm run dev
```

Success looks like:

```
{"level":30,...,"msg":"MongoDB connected"}
{"level":30,...,"msg":"AppCheck API ready on port 5000"}
```

Then `GET http://localhost:5000/api/v1/health` should return `200` with `"database": { "status": "connected" }`.

No seed data is required. On startup the API builds the `users` and `scans` indexes (`User.init()`, `Scan.init()`) before it accepts requests.

## Collections

### `users`

Model: `backend/src/models/User.js`.

| Field          | Type   | Notes |
| -------------- | ------ | ----- |
| `_id`          | ObjectId | Exposed to clients as `id` |
| `name`         | String | Required, trimmed, 1-100 characters |
| `email`        | String | Required, trimmed, **lowercased**, at most 254 characters, **unique** |
| `passwordHash` | String | bcrypt hash; `select: false` (never loaded unless explicitly requested) |
| `role`         | String | `user` (default) or `admin` |
| `tokenVersion` | Number | Default 0, `select: false`. Incremented on sign-out or role change to revoke sessions |
| `lastLoginAt`  | Date   | Set on successful login |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps |

Indexes: `{ email: 1 }` **unique**. Emails are normalized before saving, so `Ada@Example.com` and `ada@example.com` are the same account. The unique index, not an application-level check, enforces this, so concurrent registrations cannot create duplicates.

The schema uses `strict: 'throw'`: writing an unknown field is an error rather than being silently dropped. The model's `toJSON` removes `passwordHash`, `tokenVersion`, and `__v`, and API responses use the explicit `toSafeProfile()` allowlist.

### `scans`

Model: `backend/src/models/Scan.js`. One document per scan. Created `queued`; for URL scans the worker updates status, timestamps, and results (see ARCHITECTURE.md).

| Field | Type | Notes |
| ----- | ---- | ----- |
| `_id` | ObjectId | Exposed to clients as `id` |
| `userId` | ObjectId, ref `User` | Required, **immutable**. Always the authenticated user; never read from a request |
| `type` | String | Required, immutable. `url` or `source` |
| `target` | String | Required, immutable, trimmed, at most 2048 characters. Normalized URL for `url`, project name (at most 100 characters, enforced by the API) for `source` |
| `status` | String | `queued` (default), `running`, `completed`, `failed` |
| `securityScore` | Number or null | 0-100. Default `null`; only a future scanner may set it |
| `findingsCount` | Number or null | Non-negative integer. Default `null` ("no results yet", which is different from 0 findings) |
| `startedAt`, `completedAt` | Date or null | Set by the worker |
| `severityCounts` | Object or null | `{ critical, high, medium, low, info }` of a completed scan |
| `engine` | String or null | e.g. `OWASP ZAP baseline` |
| `errorCode`, `errorMessage` | String or null | Client-safe failure summary |
| `lockedBy`, `heartbeatAt` | String / Date, `select: false` | Worker lease and liveness; never returned by the API |
| `createdAt`, `updatedAt` | Date | Mongoose timestamps |

Indexes (every history query filters by `userId`):

| Index | Serves |
| ----- | ------ |
| `{ userId: 1, createdAt: -1, _id: -1 }` | Default history order (newest first, stable paging), counts |
| `{ userId: 1, type: 1, createdAt: -1 }` | History filtered by type |
| `{ userId: 1, status: 1, createdAt: -1 }` | History filtered by status |
| `{ status: 1, type: 1, createdAt: 1 }` | Worker queue (oldest queued URL scan) and stale-scan recovery |

Sorting by `target`, `type`, or `status` uses the `userId` prefix of these indexes and sorts that user's records in memory, which is fine at per-user scale.

The schema uses `strict: 'throw'`, so arbitrary request data or metadata cannot be stored. API responses are built by `toPublicScan()`, an explicit allowlist that omits `userId` and `__v`.

Deleting a user does not yet delete their scans or findings; account deletion is not an API feature.

### `findings`

Model: `backend/src/models/Finding.js`. One document per scanner rule per scan, created only by the worker from a real ZAP report.

| Field | Notes |
| ----- | ----- |
| `userId`, `scanId` | Owner and scan; immutable. Reads always filter by both |
| `source`, `ruleId`, `fingerprint` | `zap`, ZAP alert reference, and the dedupe key `zap:<ruleId>` |
| `title`, `severity`, `confidence` | Severity `critical`/`high`/`medium`/`low`/`info` |
| `description`, `remediation` | Plain text, at most 4000 characters each |
| `references`, `cweId`, `wascId` | Up to 5 http(s) links; numeric IDs |
| `affectedUrl`, `instances`, `occurrences` | First URL; up to 10 `{ url, method, param, evidence }` (evidence at most 300 characters, secrets masked); total count reported by ZAP |
| `createdAt`, `updatedAt` | Timestamps |

Indexes: `{ scanId: 1, fingerprint: 1 }` **unique** (one finding per rule per scan), `{ userId: 1, scanId: 1, severity: 1 }`. Schema is `strict: 'throw'`.

### Changing a role

There is no API for this. With database access:

```bash
cd backend
npm run user:set-role -- someone@example.com admin   # or: user
```

## Integration tests and the test database

`backend/tests/auth.integration.test.js` and `backend/tests/scan.integration.test.js` **require Atlas credentials**. They connect with `TEST_MONGODB_URI`, or `MONGODB_URI` from `backend/.env` if that is not set, and always uses a separate database, `appcheck_test` (override with `TEST_MONGODB_DB_NAME`), and refuse to run against any other database name. Each run creates users with unique `it-<run id>-...@example.com` / `scan-it-<run id>-...@example.com` emails and deletes only those users and their scans afterwards. The scan tests insert one `failed` record directly as a fixture for the status filter; the API itself never creates one.

If the database cannot be reached, those tests are reported as **skipped** with the connection error. They are never reported as passing.

## Common errors

| Message | Cause / fix |
| ------- | ----------- |
| `MONGODB_URI is required` | Variable missing in `backend/.env` |
| `still contains <placeholder> values` | Copied `.env.example` without editing |
| `querySrv ECONNREFUSED _mongodb._tcp...` | Node could not reach a DNS server for the SRV lookup. Set `DNS_SERVERS=8.8.8.8,1.1.1.1` (or your router/ISP DNS) in `backend/.env`, or use Atlas's non-SRV (`mongodb://`) connection string. |
| `Could not connect to any servers in your MongoDB Atlas cluster ... IP that isn't whitelisted` | Add your current public IP in Atlas *Network Access* (it can take a minute to apply). Also check that a firewall/VPN is not blocking port 27017. A useful distinction: if TCP connections to the shard hosts on port 27017 succeed but the TLS handshake fails with `tlsv1 alert internal error`, Atlas is rejecting your IP (Network Access), not your network. |
| `Could not create database indexes` | The database user lacks permission to create indexes, or an existing duplicate email prevents building the unique index |
| `bad auth : authentication failed` | Wrong user or password, or the password has unencoded special characters |
