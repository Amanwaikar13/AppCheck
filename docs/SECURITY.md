# Security (Phase 5)

This describes the security controls that exist **today**: configuration hygiene, HTTP hardening, authentication/authorization, and scan-record ownership. URL scans are executed by OWASP ZAP (baseline, passive) in Docker; see [URL scanner](#url-scanner-phase-5).

## Secrets and environment variables

- Secrets (`MONGODB_URI`, `JWT_SECRET`) live only in `backend/.env`, which is git-ignored (root `.gitignore` and `frontend/.gitignore` ignore `.env*` except `.env.example`).
- `.env.example` files contain placeholders only. Startup rejects `MONGODB_URI` or `JWT_SECRET` values that still contain `<placeholder>` text, and `JWT_SECRET` values shorter than 32 characters.
- The backend validates configuration at startup. Validation errors name the variable but never print its value.
- MongoDB errors are passed through `redactConnectionStrings()` so credentials in a URI are replaced with `<credentials>` before logging.
- **Frontend:** only `NEXT_PUBLIC_*` variables reach the browser, and they are inlined into the JavaScript bundle at build time. Only `NEXT_PUBLIC_API_URL` (a non-secret URL) is used.
- The frontend never connects to MongoDB; all database access goes through the API.
- Use a different random `JWT_SECRET` per environment. Changing it signs everyone out.

## Authentication design

### Decision: HttpOnly cookie for the browser, bearer accepted for API clients

AppCheck's frontend and API run on different origins (`localhost:3000` and `localhost:5000` locally). For a deployment that keeps them on the **same site**, for example `app.example.com` and `api.example.com`, an HttpOnly cookie is the stronger choice:

| | HttpOnly cookie (chosen for the browser) | Bearer token in JS memory/storage |
|---|---|---|
| Token theft via XSS | Not readable by JavaScript | Readable; `localStorage` persists it |
| Survives page reload | Yes | Only if persisted (which increases XSS risk) |
| CSRF exposure | Yes; mitigated below | None |
| Cross-site deployments | Blocked by browsers' third-party cookie rules | Works |

So the browser uses the cookie, and the token never appears in a response body or in browser storage. `Authorization: Bearer` is also accepted (same JWT) so scripts and tools can call the API; browsers never attach that header automatically, so it is not CSRF-prone.

**Deployment requirement:** the frontend and API must share a registrable domain (same site), or the API must be served through the frontend's origin (reverse proxy). A cross-site deployment such as `*.vercel.app` with `*.onrender.com` would need a different design (e.g. a backend-for-frontend proxy).

### Session token

- JWT signed with HS256 using `JWT_SECRET`; verification pins the algorithm (`alg: none` and algorithm confusion are rejected), issuer (`appcheck-api`), audience (`appcheck-web`), and expiry.
- Claims: `sub` (user id), `ver` (session version), `iat`, `exp`. No email, name, or role is stored in the token.
- Lifetime: `JWT_EXPIRES_IN` (default `1h`); the cookie's `Max-Age` matches. There are no refresh tokens. When the token expires the user signs in again.
- On every authenticated request the user is loaded from the database. Deleted users, role changes, and revoked sessions therefore take effect immediately, not at token expiry.

### Cookie

`appcheck_session`: `HttpOnly`, `SameSite=Strict`, `Path=/api/v1`, `Secure` when `NODE_ENV=production`, `Max-Age` = token lifetime.

### Sign-out and revocation

Each user has a `tokenVersion`. Sign-out clears the cookie **and** increments the version, so every outstanding token for that user stops working (all devices), including any copy of the token. Changing a user's role via the CLI also increments it.

### CSRF protection

Cookie-authenticated, state-changing requests are protected in layers:

1. `SameSite=Strict`: the browser does not send the cookie on cross-site requests.
2. **Origin check:** `POST`/`PUT`/`PATCH`/`DELETE` requests with an `Origin` header must come from `FRONTEND_URL`.
3. **Custom header:** those requests must include `X-Requested-With: XMLHttpRequest`. A cross-origin page cannot add a custom header without a CORS preflight, and preflights only succeed for allowed origins. Requests carrying an `Authorization` header are exempt from this rule only.
4. **Credentialed CORS:** `credentials: true` with an explicit origin allowlist (never `*`).

### Passwords

- bcrypt with a cost factor of `BCRYPT_SALT_ROUNDS` (default 12, allowed 10–15).
- Policy: at least 10 characters. Passwords over 72 bytes are **rejected**, because bcrypt silently ignores input beyond that.
- Plaintext passwords are never stored, logged, or returned. The `passwordHash` field is excluded from queries by default (`select: false`), stripped by the model's `toJSON`, and responses are built from an explicit allowlist (`toSafeProfile()`).
- Login returns the same `401 INVALID_CREDENTIALS` for unknown emails and wrong passwords. Unknown emails still run a bcrypt comparison so response times are similar.

### Roles

- Roles are `user` and `admin`. `requireRole(...roles)` middleware returns `403 FORBIDDEN` for other roles.
- Registration always creates `user`. Request bodies are validated with strict Zod schemas, so a `role` (or any other unknown) field is rejected with `400`, never applied.
- There is **no public admin registration**. An operator with database access promotes an existing account:

  ```bash
  cd backend
  npm run user:set-role -- someone@example.com admin
  ```

  This also signs that user out everywhere.

### Rate limiting

| Scope | Limit | Key |
| ----- | ----- | --- |
| All `/api/v1` routes, anonymous | 100 requests / 15 min | client IP |
| All `/api/v1` routes, valid session | 600 requests / 15 min | user ID |
| `POST /auth/login` | 10 **failed** attempts / 15 min (successful sign-ins are not counted) | client IP |
| `POST /auth/register` | 5 attempts / 15 min | client IP |
| `POST /scans/url` + `POST /scans/source` | 20 **created** scans / 15 min | user ID |

**Why the global limit is split (fix for login 429s).** Originally a single limit of 100 requests per 15 minutes per IP covered every API call, including the session check and health check on every page load and every signed-in data read. Normal use, or a test run, could exhaust it, after which `POST /auth/login` returned `429` for up to 15 minutes regardless of credentials. Requests carrying a **valid** session token now count against a per-user bucket instead, so signed-in browsing cannot lock the IP out of signing in, and users behind one NAT do not share a budget. The token signature, issuer, audience, and expiry are verified before a user bucket is used, so forged or expired tokens count against the IP. Anonymous traffic, including login and registration, keeps the original per-IP limit, and the login and registration limiters are unchanged.

Every 429 includes `Retry-After` (seconds) and `RateLimit`/`RateLimit-Policy` headers, exposed to the browser via CORS. The frontend shows how long to wait and disables the sign-in button until then; it never retries automatically. Each limit hit is logged at `warn` with the limiter name, key type (IP or user ID), limit, reset time, IP, method, and path. Bodies, cookies, and tokens are never logged.

**Client IP and proxies.** `req.ip` uses `X-Forwarded-For` only when `TRUST_PROXY` is set (hop count such as `1`, or proxy addresses/subnets such as `loopback`). It is off by default, so a client cannot spoof the header to get fresh per-IP buckets. `TRUST_PROXY=true` is rejected at startup. Behind a reverse proxy, set it to match the real proxy chain, or every client will appear to share the proxy IP.

Limits are in memory per process: they reset on restart and are not shared between instances.

### Input validation and errors

- All auth and scan request bodies, scan query strings, and scan path parameters are validated with strict Zod schemas (unknown fields are rejected). Errors return `400 VALIDATION_ERROR` with field paths and messages, never the submitted values.
- Unexpected errors are logged server-side and returned as a generic `500`. Database outages return `503 DATABASE_UNAVAILABLE` instead of hanging.

### Frontend

- Protected pages are wrapped in `AuthGate`, which asks `GET /auth/me` whether a session exists. Signed-out visitors are redirected to `/login?next=<path>`. The user's identity is shown only after the API confirms the session.
- This guard improves UX; it is not the security boundary. The API enforces authentication on every protected request.
- The `next` redirect target is restricted to same-origin paths (`safeNextPath`), which prevents open redirects such as `//evil.example`.

## Scan records (Phase 4)

### Ownership and authorization

- Every `/api/v1/scans` route runs `authenticate` first; there is no public access to scan records.
- The owner (`userId`) is taken from the authenticated session (`req.user`) and is **immutable** in the schema. Request bodies and query strings that include `userId` (or any unknown field) are rejected with `400`, so a client can neither assign a scan to someone else nor widen a query.
- Every read filters on both the scan ID **and** the session user: `Scan.findOne({ _id, userId })`. A scan owned by another user returns the same `404 SCAN_NOT_FOUND` as a nonexistent one, so IDs cannot be probed.
- Scan IDs are validated as 24 hex characters before any query, so operator payloads (`{"$ne": null}`) and malformed IDs never reach MongoDB.
- List sorting accepts only an allowlist (`createdAt`, `target`, `type`, `status`), so clients cannot sort by, or infer, fields outside the public representation.
- Responses use an explicit allowlist (`toPublicScan()`) that omits `userId`, and are sent with `Cache-Control: no-store`.
- The frontend clears cached scan records from Redux on sign-in, registration, and sign-out, so a second account in the same browser tab never sees the previous account's records.

### Protected fields and honest status

- Clients can set only `url` or `projectName`. `status`, `securityScore`, `findingsCount`, `startedAt`, `completedAt`, and timestamps are rejected by strict schemas and are left to model defaults (`queued` / `null`).
- No endpoint updates a scan. Only the background worker changes status, and only from a real scanner run (see below). Source scans are never executed and stay **Not executed**.

### Scan targets

URL targets are validated when a scan is recorded (`backend/src/validators/scan.validators.js`, `backend/src/utils/networkTarget.js`):

- `http:` and `https:` only; malformed URLs, whitespace, and control characters are rejected.
- URLs with embedded credentials (`user:pass@`) are rejected, so secrets are never stored as targets.
- IP literals in loopback, private (RFC 1918), carrier-grade NAT, link-local (including cloud metadata at `169.254.169.254`), documentation, benchmarking, multicast, reserved, unique-local, link-local IPv6, NAT64, 6to4, and IPv4-mapped IPv6 ranges are rejected. WHATWG URL parsing normalizes shorthand such as `http://2130706433` and `http://0x7f.1` first.
- `localhost`, `*.localhost`, internal suffixes (`.local`, `.internal`, `.lan`, `.home.arpa`, ...), and single-label hosts are rejected.

Since Phase 5 the hostname is also **resolved** at submission (`TARGET_NOT_ALLOWED` if any answer is non-public) and again when the scan runs, and the scanner connects only to the address checked then (see below).

Source scans accept only a project name (letters, digits, spaces, `. _ - /`; no `..`). It is a label, never used as a file path. No files are accepted.

## URL scanner (Phase 5)

**What runs:** `zap-baseline.py` from the official `zaproxy/zap-stable` image: a spider (2 minutes) plus passive rules. No active attack rules run. Scans run in a background worker inside the API process, one at a time, never inside an HTTP request. The worker is off unless `URL_SCANNER=zap-docker`.

**SSRF defenses (each covered by automated tests):**

1. **URL text policy** at submission: http(s) only, no credentials, no local/private/reserved IP literals or internal hostnames.
2. **DNS policy** at submission *and again at execution* (`scanner/targetPolicy.js`): every resolved address must be public, and one checked address is **pinned** for the scan. Lookups time out after 5 s.
3. **Egress guard** (`scanner/egressProxy.js`): ZAP is configured to send all traffic through a per-scan forward proxy that:
   - never resolves DNS and connects only to the pinned address, so DNS rebinding cannot redirect it;
   - accepts only the submitted hostname, on its port or 80/443. **Redirects or links to any other host are refused (403)**, so a redirect to `169.254.169.254` or an internal name is never followed;
   - requires random per-scan proxy credentials and listens on `127.0.0.1` by default;
   - enforces a 10 s connect timeout, 30 s idle timeout, a 10 MB per-response cap (plain HTTP), and caps of 200 MB and 5000 requests per scan.
4. **Process safety** (`scanner/zapRunner.js`): `docker` is started with `spawn(..., { shell: false })` and an argument array; the URL is one argv element and never reaches a shell. `ZAP_DOCKER_IMAGE` is validated as an image reference.
5. **Container constraints:** `--cap-drop=ALL`, `--security-opt=no-new-privileges`, `--memory 2g`, `--cpus 1.5`, `--pids-limit 512`, `--rm`, ZAP's own non-root user, a private temporary work directory deleted afterwards, and a hard 15-minute kill (`docker kill`).

**Results:** findings come only from the ZAP JSON report. HTML is stripped; text is length-limited; evidence is cut to 300 characters with cookie values, tokens, and long opaque strings masked; only http(s) reference links are kept and rendered as text links. Findings are stored with their owner and scan, deduplicated per scan and ZAP rule (unique index), and readable only through `GET /scans/:id/findings` by the scan owner (404 otherwise). Severity: ZAP High/Medium/Low/Informational map to the same AppCheck levels; ZAP never reports Critical.

**Baseline score:** `100 − (25 × critical + 10 × high + 4 × medium + 1 × low)`, minimum 0, counting distinct findings (ZAP rules), not affected URLs. Informational findings do not affect it. It describes one passive scan, not the application's overall security, and is labeled that way.

**Failures:** a failed scan stores only a fixed code and message (`TARGET_NOT_ALLOWED`, `TARGET_UNRESOLVABLE`, `SCANNER_UNAVAILABLE`, `SCANNER_TIMEOUT`, `SCANNER_FAILED`, `SCAN_INTERRUPTED`, `SCAN_FAILED`). Scanner output, stack traces, and addresses go to server logs only.

### Scanner limitations (not complete protections)

- **ZAP has never been executed against this code** (no Docker was available on the development machine; all scanner tests mock the ZAP step). The proxy option names (`network.connection.httpProxy.enabled/host/port/authEnabled/realm/username/password/storePass`) were checked against the source of ZAP's Network add-on (`ConnectionOptions.java`) and match. Whether ZAP actually routes **all** of its traffic through the proxy at runtime, authenticates with it, and does not resolve or contact hosts directly is **not verified**. Until a real run shows `proxyStats.requests > 0` and the boundary tests in DEVELOPMENT.md pass with real ZAP, treat the scanner as unverified and keep `URL_SCANNER=disabled` outside a lab.
- **Network isolation relies on ZAP honoring its proxy setting.** The ZAP container is on Docker's default bridge network. If ZAP sent traffic directly (bug or misconfiguration), it could reach whatever the Docker host can reach, including private networks. Stronger isolation (ZAP on an `--internal` Docker network with only an egress-proxy container attached) is recommended before production use.
- The per-scan proxy password is passed on the `docker run` command line, so other local users of the host can see it while a scan runs. It only grants access to the egress guard for that scan's target.
- On Linux Docker Engine, `host.docker.internal` reaches the host via the bridge gateway; the egress proxy must then bind to that address (`SCANNER_PROXY_BIND`). Never bind it to a public interface.
- HTTPS traffic passes through CONNECT tunnels: the guard enforces host, port, time, and total-byte limits on them but cannot inspect individual HTTPS responses.
- Only the exact submitted hostname is scanned (no other subdomains), and only one of its addresses is used.
- The container root filesystem is not read-only (ZAP writes to its home directory).
- One scan runs at a time per API process. A scan interrupted by a restart is marked failed, not retried. Scans whose worker stops reporting are failed after about 25 minutes.
- The "I am authorized" confirmation on the form is not recorded server-side, and ownership of the target is not verified (no DNS/file challenge).
- `SCANNER_LAB_TARGETS` deliberately bypasses the private-address checks for named `*.test` hosts. It is rejected when `NODE_ENV=production`.

## HTTP hardening (backend)

| Control | Implementation |
| ------- | -------------- |
| Security headers | `helmet()` defaults (CSP, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, frame protections, etc.); `X-Powered-By` disabled |
| CORS | Explicit allowlist from `FRONTEND_URL`, credentials enabled, allowed headers `Content-Type`, `Authorization`, `X-Requested-With` |
| Body size | `express.json({ limit: '100kb' })` |
| Caching | Auth and scan responses send `Cache-Control: no-store` |
| Error handling | Central handler returns `{ error: { code, message, details? } }`; no stack traces |
| Logging | Pino JSON logs. Redacted: `authorization` and `cookie` request headers, `set-cookie`, request bodies, and fields named `password`, `passwordHash`, `currentPassword`, `newPassword`, `token`, `accessToken`, `refreshToken`, `secret`, `jwt`, `jwtSecret`, `JWT_SECRET`, `mongodbUri`, `MONGODB_URI` (top level and one level nested) |
| Health endpoint | Returns only status values, environment name, and timestamp |

## Known limitations / to address later

- **Token lifetime vs. revocation:** sign-out revokes all of a user's sessions at once. There is no per-device sign-out and no refresh-token rotation.
- **Email enumeration:** registration returns `409 EMAIL_TAKEN` for existing emails, which reveals that an account exists. This is a usability tradeoff; rate limiting reduces bulk probing.
- **Rate limits are in memory.** They reset on restart and are not shared between instances (a shared store such as Redis would be needed for multiple instances). Behind a reverse proxy, set `TRUST_PROXY`.
- No account lockout, email verification, password reset, or MFA yet.
- `npm audit` (frontend) reports high-severity advisories in `braces`, pulled in by the dev-only ESLint toolchain. It does not ship to the browser.
- `multer` is installed in the backend for a later phase (ZIP upload) but is not used.
- The URL scan form asks users to confirm they are authorized to test the target, but this confirmation is not yet recorded server-side.
- Scans of a deleted user are not deleted (there is no account-deletion API yet).

## Responsible use

AppCheck is intended only for applications and code you own or are explicitly authorized to test.
