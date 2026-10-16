# API Reference

Base URL (local): `http://localhost:5000/api/v1`

All responses are JSON. All routes under `/api/v1` are rate limited: 100 requests per 15 minutes per IP for anonymous requests, and 600 per 15 minutes per user for requests with a valid session. The auth and scan-creation endpoints have additional limits, listed below. A `429 RATE_LIMITED` response includes a `Retry-After` header (seconds); see [SECURITY.md](SECURITY.md#rate-limiting).

> **Scanner execution:** URL scans are executed by a background OWASP ZAP baseline worker when the server enables it (`URL_SCANNER=zap-docker`); check `GET /scanner/status`. Source scans are recorded but not executed. See [Scans](#scans).

## Authentication

Sessions are JSON Web Tokens (HS256) issued by `POST /auth/register` and `POST /auth/login`.

- **Browsers** receive the token in an `HttpOnly` cookie, `appcheck_session` (`SameSite=Strict`, `Path=/api/v1`, `Secure` in production, `Max-Age` = `JWT_EXPIRES_IN`). JavaScript cannot read it and the token is never included in a response body. Requests must be sent with credentials (`fetch(..., { credentials: 'include' })` / Axios `withCredentials: true`).
- **Other clients** (scripts, Postman) may send the same token as `Authorization: Bearer <token>`; it takes precedence over the cookie. A client can take the token from the `Set-Cookie` header of the login response.

Protected endpoints load the user on every request, so deleting a user, changing their role, or signing out takes effect immediately.

### CSRF requirement

Every `POST`, `PUT`, `PATCH`, and `DELETE` under `/api/v1` must:

1. come from an allowed origin if the request has an `Origin` header (`FRONTEND_URL`), and
2. include the header `X-Requested-With: XMLHttpRequest`, unless it carries an `Authorization` header.

Otherwise the API responds `403 CSRF_REJECTED`. The frontend's Axios client adds the header automatically.

## Error format

Every error response has the same shape:

```json
{ "error": { "code": "NOT_FOUND", "message": "Route GET /api/v1/nope not found" } }
```

Validation errors (request body, query string, or path parameters) add `details`, one entry per invalid field. Submitted values are never echoed back.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "path": "email", "message": "Enter a valid email address" },
      { "path": "password", "message": "Password must be at least 10 characters" }
    ]
  }
}
```

| Status | Code                   | When |
| ------ | ---------------------- | ---- |
| 400    | `INVALID_JSON`         | Request body is not valid JSON |
| 400    | `VALIDATION_ERROR`     | Body, query, or path parameter failed validation (missing/invalid fields, unknown fields such as `role` or `userId`, malformed scan IDs) |
| 401    | `AUTH_REQUIRED`        | No session cookie or bearer token |
| 401    | `INVALID_TOKEN`        | Token malformed, forged, for a deleted user, or revoked by sign-out/role change |
| 401    | `TOKEN_EXPIRED`        | Token past its expiry; sign in again |
| 401    | `INVALID_CREDENTIALS`  | Wrong email or password (same response for both) |
| 403    | `CSRF_REJECTED`        | State-changing request without the CSRF header, or from a disallowed origin |
| 403    | `FORBIDDEN`            | Authenticated, but the user's role is not allowed |
| 404    | `NOT_FOUND`            | Unknown route |
| 400    | `TARGET_NOT_ALLOWED`   | URL scan target resolves to a local/private/reserved address or cannot be resolved (`details[0].path = "url"`) |
| 404    | `SCAN_NOT_FOUND`       | The scan does not exist **or belongs to another user** (same response for both) |
| 409    | `EMAIL_TAKEN`          | Registration with an email that already has an account |
| 413    | `PAYLOAD_TOO_LARGE`    | JSON body larger than 100 KB |
| 429    | `RATE_LIMITED`         | Rate limit exceeded (global, auth, or scan creation) |
| 500    | `INTERNAL_ERROR`       | Unexpected server error (details are logged, never returned) |
| 503    | `DATABASE_UNAVAILABLE` | The database is not connected; retry later |

Stack traces, file paths, connection strings, password hashes, and tokens are never included in responses.

---

## GET /api/v1

API information.

**200 OK**

```json
{
  "name": "AppCheck",
  "version": "v1",
  "endpoints": {
    "health": "/api/v1/health",
    "register": "/api/v1/auth/register",
    "login": "/api/v1/auth/login",
    "logout": "/api/v1/auth/logout",
    "me": "/api/v1/auth/me",
    "scans": "/api/v1/scans",
    "scannerStatus": "/api/v1/scanner/status"
  }
}
```

---

## GET /api/v1/health

Reports whether the API and its MongoDB Atlas connection are working. The application is only considered healthy when the database is connected.

**200 OK** — healthy

```json
{
  "name": "AppCheck",
  "status": "healthy",
  "database": { "status": "connected" },
  "environment": "development",
  "timestamp": "2026-10-12T09:30:00.000Z"
}
```

**503 Service Unavailable** — the API is running but the database is not connected

```json
{
  "name": "AppCheck",
  "status": "unhealthy",
  "database": { "status": "disconnected" },
  "environment": "development",
  "timestamp": "2026-10-12T09:30:00.000Z"
}
```

| Field             | Values |
| ----------------- | ------ |
| `status`          | `healthy`, `unhealthy` |
| `database.status` | `connected`, `connecting`, `disconnecting`, `disconnected` |
| `environment`     | value of `NODE_ENV` |
| `timestamp`       | ISO 8601, server time |

The response has `Cache-Control: no-store`.

If the API process is not running at all, there is no response (connection refused); the frontend shows the API server as **Unreachable**.

### Trying it

- **Browser:** open <http://localhost:5000/api/v1/health>.
- **curl:** `curl -i http://localhost:5000/api/v1/health`
- **Postman:** create a `GET` request to `{{baseUrl}}/health` with a collection variable `baseUrl = http://localhost:5000/api/v1`. Expect status 200 and `"status": "healthy"` when Atlas is connected.

---

## User profile

Auth endpoints return only this safe profile. Password hashes and internal session data are never returned.

```json
{
  "id": "6720c3f5a1b2c3d4e5f60718",
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "role": "user",
  "createdAt": "2026-10-13T10:00:00.000Z",
  "lastLoginAt": "2026-10-13T10:05:00.000Z"
}
```

`role` is `user` or `admin`. Registration always creates `user`; see [SECURITY.md](SECURITY.md#roles) for how admins are created.

---

## POST /api/v1/auth/register

Creates an account and signs it in. Requires the [CSRF header](#csrf-requirement).
Rate limit: 5 attempts per 15 minutes per IP.

**Body** (unknown fields are rejected):

| Field      | Rules |
| ---------- | ----- |
| `name`     | string, 1-100 characters after trimming |
| `email`    | valid email, at most 254 characters; trimmed and lowercased |
| `password` | string, at least 10 characters and at most 72 bytes (bcrypt's input limit) |

**201 Created**: sets the `appcheck_session` cookie.

```json
{ "user": { "id": "...", "name": "Ada Lovelace", "email": "ada@example.com", "role": "user", "createdAt": "...", "lastLoginAt": null } }
```

Errors: `400 VALIDATION_ERROR` (including any attempt to send `role`), `409 EMAIL_TAKEN` (case-insensitive), `403 CSRF_REJECTED`, `429 RATE_LIMITED`, `503 DATABASE_UNAVAILABLE`.

---

## POST /api/v1/auth/login

Signs in. Requires the [CSRF header](#csrf-requirement).
Rate limit: 10 **failed** attempts per 15 minutes per IP; successful logins are not counted.

**Body** (unknown fields are rejected): `email` (as above), `password` (string, 1-1024 characters).

**200 OK**: sets the `appcheck_session` cookie and returns `{ "user": { ... } }`.

Errors: `401 INVALID_CREDENTIALS` (same message whether or not the email exists), `400 VALIDATION_ERROR`, `403 CSRF_REJECTED`, `429 RATE_LIMITED`, `503 DATABASE_UNAVAILABLE`.

---

## POST /api/v1/auth/logout

Signs out. Requires the [CSRF header](#csrf-requirement) (or a bearer token).

Always clears the session cookie. If the presented token is still valid, the user's session version is incremented, which **revokes every token issued to that user** (all devices), including copies of the token.

**204 No Content**

---

## GET /api/v1/auth/me

Returns the signed-in user. Requires a session cookie or bearer token.

**200 OK**: `{ "user": { ... } }` with `Cache-Control: no-store`.

Errors: `401 AUTH_REQUIRED`, `401 INVALID_TOKEN`, `401 TOKEN_EXPIRED`, `503 DATABASE_UNAVAILABLE`.

### Trying the auth endpoints

```bash
# Register (stores the session cookie in cookies.txt)
curl -i -c cookies.txt -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" \
  -d '{"name":"Ada","email":"ada@example.com","password":"a long passphrase"}'

# Who am I?
curl -i -b cookies.txt http://localhost:5000/api/v1/auth/me

# Sign out
curl -i -b cookies.txt -X POST http://localhost:5000/api/v1/auth/logout -H "X-Requested-With: XMLHttpRequest"
```

In **Postman**, add the header `X-Requested-With: XMLHttpRequest` to POST requests; Postman stores and sends the cookie automatically.

---

## Scans

A scan record says that a user asked for a URL or source-code scan. **URL scans** are picked up by the background worker, which runs an OWASP ZAP baseline scan (passive checks only) and stores the results; status moves `queued` → `running` → `completed` or `failed`. **Source scans** are recorded only and stay `queued`.

The worker runs only when the server sets `URL_SCANNER=zap-docker` and Docker plus the ZAP image are available. Otherwise URL scans stay `queued` until it is. Clients can never set status, results, or timestamps.

All scan endpoints:

- require authentication (session cookie or `Authorization: Bearer`), otherwise `401`;
- are scoped to the signed-in user. The owner is always taken from the session, never from the request. Other users' scans are invisible: reading one returns the same `404 SCAN_NOT_FOUND` as a scan that does not exist;
- send `Cache-Control: no-store`;
- return `503 DATABASE_UNAVAILABLE` when the database is down.

`POST` endpoints also require the [CSRF header](#csrf-requirement) (or a bearer token).

### Scan object

```json
{
  "id": "6720c3f5a1b2c3d4e5f60718",
  "type": "url",
  "target": "https://app.example.com/",
  "status": "queued",
  "securityScore": null,
  "findingsCount": null,
  "startedAt": null,
  "completedAt": null,
  "severityCounts": null,
  "engine": null,
  "error": null,
  "createdAt": "2026-10-15T10:00:00.000Z",
  "updatedAt": "2026-10-15T10:00:00.000Z"
}
```

| Field | Values |
| ----- | ------ |
| `type` | `url` or `source` |
| `target` | Normalized URL (`url`) or project name (`source`) |
| `status` | `queued`, `running`, `completed`, `failed` |
| `securityScore` | Baseline score 0-100 of a completed scan: `100 − (25×critical + 10×high + 4×medium + 1×low)`, minimum 0, counting distinct findings. `null` until completed |
| `findingsCount` | Number of distinct findings of a completed scan; `null` means "no results" (not "zero findings") |
| `severityCounts` | `{ critical, high, medium, low, info }` for a completed scan, else `null` |
| `engine` | `"OWASP ZAP baseline"` once a URL scan has started, else `null` |
| `error` | `{ code, message }` for a failed scan (client-safe; codes: `TARGET_NOT_ALLOWED`, `TARGET_UNRESOLVABLE`, `SCANNER_UNAVAILABLE`, `SCANNER_TIMEOUT`, `SCANNER_FAILED`, `SCAN_INTERRUPTED`, `SCAN_FAILED`), else `null` |
| `startedAt`, `completedAt` | Set by the worker; `null` until then |

The owner's user ID is never included.

---

## POST /api/v1/scans/url

Queues a URL scan. Besides the URL text rules below, the host name is **resolved**: if any address is local, private, or reserved, or it cannot be resolved, the request fails with `400 TARGET_NOT_ALLOWED` (the worker checks again before scanning). Rate limit: 20 **created** scans (URL and source combined) per user per 15 minutes; rejected requests are not counted against it.

**Body** (unknown fields are rejected):

| Field | Rules |
| ----- | ----- |
| `url` | string, at most 2048 characters, trimmed. Must be an absolute `http://` or `https://` URL with a host. Rejected: other schemes (`ftp:`, `file:`, `javascript:`, ...), embedded credentials (`https://user:pass@...`), whitespace or control characters, and local or private targets (see below) |

Local and private targets are rejected: `localhost` and `*.localhost`; names ending in `.local`, `.localdomain`, `.internal`, `.intranet`, `.lan`, `.home.arpa`, `.corp`, `.private`; single-label hosts such as `http://intranet`; and IP literals in loopback, private, link-local (including `169.254.169.254`), carrier-grade NAT, documentation, benchmarking, multicast, reserved, unique-local, and IPv4-mapped IPv6 ranges. Shorthand forms such as `http://2130706433` or `http://0x7f.1` are normalized first, so they are caught too. These checks cannot see where a public hostname resolves; see [SECURITY.md](SECURITY.md#scan-targets).

The stored `target` is the normalized URL without its `#fragment`, e.g. ` https://App.Example.com/a?b=1#top ` becomes `https://app.example.com/a?b=1`.

Clients cannot send `userId`, `status`, `securityScore`, `findingsCount`, `startedAt`, `completedAt`, `createdAt`, or any other field: the request fails with `400 VALIDATION_ERROR` and nothing is stored.

**201 Created**

```json
{
  "scan": { "id": "...", "type": "url", "target": "https://app.example.com/", "status": "queued", "securityScore": null, "findingsCount": null, "startedAt": null, "completedAt": null, "createdAt": "...", "updatedAt": "..." },
  "notice": "Scan queued. An OWASP ZAP baseline scan (passive checks only) will start shortly; this page shows its real status."
}
```

When the scanner is unavailable the scan is still queued, and `notice` says so (e.g. "...the URL scanner is not available on this server (Docker is not installed or not running on the scanner host)...").

Errors: `400 VALIDATION_ERROR`, `400 TARGET_NOT_ALLOWED`, `401`, `403 CSRF_REJECTED`, `429 RATE_LIMITED`, `503 DATABASE_UNAVAILABLE`.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "path": "url", "message": "URL must not point to a local, private, or reserved IP address" }]
  }
}
```

---

## POST /api/v1/scans/source

Records a source-code scan request for a named project. **No files are accepted**: ZIP upload and extraction belong to a later phase. Same rate limit as URL scans.

**Body** (unknown fields, including any file content, are rejected):

| Field | Rules |
| ----- | ----- |
| `projectName` | 1-100 characters after trimming; runs of whitespace collapse to one space. Letters, digits, spaces, and `. _ - /` only; must start with a letter or digit; no `..`, no `//`, no trailing `/`. Examples: `payments-api`, `acme/web frontend` |

**201 Created**: `{ "scan": { ..., "type": "source", "target": "acme/web frontend" }, "notice": "..." }`

Errors: as for `POST /scans/url`.

---

## GET /api/v1/scans

Lists the signed-in user's scans. Filtering, sorting, and paging run in MongoDB; only the requested page is loaded.

**Query parameters** (all optional; unknown parameters, including `userId`, are rejected with `400`):

| Parameter | Rules | Default |
| --------- | ----- | ------- |
| `page` | whole number, 1-1000 | `1` |
| `limit` | whole number, 1-100 | `20` |
| `type` | `url` or `source` | all types |
| `status` | `queued`, `running`, `completed`, `failed` | all statuses |
| `sort` | `createdAt`, `target`, `type`, `status`; prefix `-` for descending | `-createdAt` (newest first) |

Ties are broken by newest first, then by ID, so pages never overlap or skip records. A page past the end returns an empty `items` array.

**200 OK**

```json
{
  "items": [
    { "id": "...", "type": "url", "target": "https://app.example.com/", "status": "queued", "securityScore": null, "findingsCount": null, "startedAt": null, "completedAt": null, "createdAt": "...", "updatedAt": "..." }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "filters": { "type": null, "status": null },
  "sort": "-createdAt"
}
```

Errors: `400 VALIDATION_ERROR` (message `Invalid query parameters`), `401`, `503 DATABASE_UNAVAILABLE`.

---

## GET /api/v1/scans/:id

Returns one scan owned by the signed-in user.

- `:id` must be a 24-character hexadecimal ID, otherwise `400 VALIDATION_ERROR` with `details[0].path = "id"`.
- If no scan with that ID belongs to the user (it does not exist, or another user owns it): `404 { "error": { "code": "SCAN_NOT_FOUND", "message": "Scan not found" } }`.

**200 OK**: `{ "scan": { ... } }`

## GET /api/v1/scans/:id/findings

Findings of one scan owned by the signed-in user, most severe first. Same ID rules and `404 SCAN_NOT_FOUND` behavior as `GET /scans/:id` (another user's scan is indistinguishable from a missing one). Findings exist only for `completed` scans; for other statuses `items` is empty.

**200 OK**

```json
{
  "scanId": "6720c3f5a1b2c3d4e5f60718",
  "status": "completed",
  "items": [
    {
      "id": "6720c4...",
      "scanId": "6720c3f5a1b2c3d4e5f60718",
      "source": "zap",
      "ruleId": "10038",
      "title": "Content Security Policy (CSP) Header Not Set",
      "severity": "medium",
      "confidence": "high",
      "description": "Content Security Policy (CSP) is an added layer of security...",
      "remediation": "Ensure that your web server sets the Content-Security-Policy header.",
      "references": ["https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP"],
      "cweId": 693,
      "wascId": 15,
      "affectedUrl": "https://app.example.com/",
      "instances": [{ "url": "https://app.example.com/", "method": "GET", "param": "", "evidence": "" }],
      "occurrences": 3,
      "createdAt": "2026-10-16T10:05:00.000Z"
    }
  ]
}
```

`severity` is `critical`, `high`, `medium`, `low`, or `info` (ZAP never reports critical). One finding per ZAP rule per scan; `instances` holds up to 10 example locations and `occurrences` the total ZAP reported. `evidence` is truncated and has secrets masked. All text is plain text (HTML removed).

---

## GET /api/v1/scans/summary

Dashboard data for the signed-in user, from real records only.

**200 OK**

```json
{
  "counts": { "total": 7, "queued": 1, "running": 0, "completed": 4, "failed": 2 },
  "recent": [ { "id": "...", "status": "completed", "...": "five newest scan objects" } ],
  "findings": {
    "targets": 2,
    "bySeverity": { "critical": 0, "high": 1, "medium": 5, "low": 3, "info": 4 },
    "latest": { "id": "...", "target": "https://app.example.com/", "securityScore": 71, "...": "newest completed scan" }
  }
}
```

`findings.bySeverity` adds up the latest completed scan of each distinct target, so re-scanning a site does not double-count. `latest` is `null` until a scan completes.

---

## GET /api/v1/scanner/status

Whether scans can actually run on this server. Requires authentication.

**200 OK**

```json
{
  "url": {
    "engine": "OWASP ZAP baseline",
    "mode": "Passive checks only (spider and passive rules, no active attacks)",
    "enabled": true,
    "available": false,
    "reason": "Docker is not installed or not running on the scanner host"
  },
  "source": { "enabled": false, "available": false, "reason": "Source code analysis is not implemented yet" }
}
```

`enabled` reflects `URL_SCANNER`; `available` is re-checked about once a minute (Docker daemon reachable and ZAP image present).

### Trying the scan endpoints

```bash
# After signing in with curl as shown above (cookies.txt):
curl -i -b cookies.txt -X POST http://localhost:5000/api/v1/scans/url \
  -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" \
  -d '{"url":"https://app.example.com"}'

curl -i -b cookies.txt -X POST http://localhost:5000/api/v1/scans/source \
  -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" \
  -d '{"projectName":"acme/payments-api"}'

curl -i -b cookies.txt "http://localhost:5000/api/v1/scans?type=url&status=queued&sort=-createdAt&page=1&limit=10"
curl -i -b cookies.txt http://localhost:5000/api/v1/scans/<id>
curl -i -b cookies.txt http://localhost:5000/api/v1/scans/<id>/findings
curl -i -b cookies.txt http://localhost:5000/api/v1/scanner/status
```

Only submit targets you own or are explicitly authorized to test.
