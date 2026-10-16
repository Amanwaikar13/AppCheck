# Development Guide

## First-time setup

```bash
cd backend  && npm install && cp .env.example .env
cd ../frontend && npm install && cp .env.example .env.local
```

Edit `backend/.env` (at minimum `MONGODB_URI`; see [DATABASE.md](DATABASE.md)).

## Daily workflow

| Task | Command (run inside the folder) |
| ---- | ------------------------------- |
| Start API with auto-restart | `backend: npm run dev` (restarts when `src/`, `server.js`, or `.env` change) |
| Start API normally | `backend: npm start` |
| Backend tests | `backend: npm test` |
| Start frontend dev server | `frontend: npm run dev` → <http://localhost:3000> |
| Frontend tests | `frontend: npm test` (Node test runner; no browser or API needed) |
| Lint frontend | `frontend: npm run lint` |
| Production build of frontend | `frontend: npm run build && npm start` |

Start the backend first. The app checks the API once on load; the header shows the result on every page, and the **System status** card (on `/dashboard` and `/settings`) has **Check again** to re-check.

### Scans

- **URL scans** are executed by an in-process worker (`backend/src/scanner/`) running OWASP ZAP baseline scans in Docker, when `URL_SCANNER=zap-docker`. Without it (the default) they are accepted and stay `queued`; the URL Scan page shows why (`GET /scanner/status`).
- **Source scans** are recorded only.
- Do not add code that marks scans completed or fills in scores without a real scanner result. Automated tests use a mocked runner and must never scan public targets.

## Running the URL scanner

1. Install and start **Docker**. Check with `docker version` (it must show a *Server* section).
   - **Windows:** Docker Desktop needs WSL 2. In an administrator PowerShell run `wsl --install`, reboot, then install Docker Desktop (https://docs.docker.com/desktop/setup/install/windows-install/) with the WSL 2 backend, and start it. Hardware virtualization must be enabled in the firmware.
   - **macOS:** Docker Desktop. **Linux:** Docker Engine (see the Linux note in step 3).
2. Pull the ZAP image (about 1.5 GB): `docker pull zaproxy/zap-stable`
3. In `backend/.env` set `URL_SCANNER=zap-docker`.
   - **Linux Docker Engine only:** set `SCANNER_PROXY_BIND` and `SCANNER_PROXY_HOST` to the docker0 address (usually `172.17.0.1`) so the container can reach the egress proxy. Never bind to a public interface.
4. Restart the backend. The log line `Scan worker started` shows `"available": true`. If not, its `reason` says what is missing.
5. In the app, open **URL Scan**. The notice should read "OWASP ZAP baseline scanner is available". Submit a URL you are authorized to test. The scan page updates every 10 s; a baseline scan normally takes 3-15 minutes.
6. In the backend log, the `URL scan completed` line includes `proxyStats`. **`proxyStats.requests` must be greater than 0**: that shows ZAP's traffic went through the egress guard. If it is 0 while findings were produced, ZAP bypassed the proxy. Disable the scanner and report it (see SECURITY.md, scanner limitations).

### Egress boundary check with real ZAP (run this first)

```bash
cd backend && npm run scanner:lab-check
```

This needs Docker and the ZAP image, but no database and no network access beyond this machine. It starts two local servers: a **target** (scanned as `target.lab.test`) whose pages link and redirect to other hosts, and a **canary** that must never be contacted. It then runs real ZAP baseline scans through the egress proxy and checks that:
- traffic went through the proxy (`requests > 0`) with the correct Host header;
- cross-host links and redirects were blocked (`blocked > 0`);
- **the canary received no requests**, so ZAP did not bypass the proxy by name or via `host.docker.internal`;
- the genuine ZAP report normalizes into findings;
- the request cap and the time limit are enforced.

It exits `0` if every check passed, `1` on failure, and `2` if Docker/ZAP are unavailable (nothing was run). The canary listens on `127.0.0.1` and is reachable from the container the same way the proxy is, so a passing proxy run means a bypass would have reached it. **If any check fails, keep `URL_SCANNER=disabled`.**

### Controlled lab test (deliberately vulnerable local target)

Local addresses are blocked by design. To test end to end against your own vulnerable app without weakening that rule, map a reserved `.test` name to it (development only; rejected in production):

```bash
# Publish on 127.0.0.1 only: a deliberately vulnerable app must not be reachable from your network.
docker run --rm -d --name juice-shop -p 127.0.0.1:3001:3000 bkimminich/juice-shop
# backend/.env
URL_SCANNER=zap-docker
SCANNER_LAB_TARGETS=juice.lab.test=127.0.0.1
```

Restart the backend (it logs a warning listing the lab hosts), then scan `http://juice.lab.test:3001/`. Expect findings such as missing CSP and anti-clickjacking headers. Stop the target afterwards with `docker stop juice-shop`, and remove `SCANNER_LAB_TARGETS`. Never point lab names at systems you are not authorized to test.

### Conventions

- Backend uses ES modules (`"type": "module"`), so relative imports include the `.js` extension.
- Keep `src/app.js` free of I/O (no `listen`, no DB connect) so it stays testable; startup belongs in `server.js`.
- Request flow in the backend: route → controller → service. Throw `ApiError(status, code, message)` for expected errors; let the error handler format responses.
- Frontend uses the `@/` import alias for `src/`. Components that use hooks, Redux, or browser APIs need `"use client"`.
- The frontend's Next.js version (16) has changes from older versions; consult `frontend/node_modules/next/dist/docs/` (see `frontend/AGENTS.md`).

### Tests

`frontend/tests/` (run with `npm test` in `frontend/`) uses Node's test runner with a small resolve hook for the `@/` alias, and a fake Axios transport. It covers `Retry-After` parsing, 429 messages, and deduplication of session, health, scan, and login/registration requests.

`backend/tests/` uses Node's built-in test runner (`node:test`). Most tests need no database. They cover:

- Config validation (missing/invalid `MONGODB_URI`, placeholders, invalid `FRONTEND_URL`, secrets not echoed)
- `GET /api/v1/health` returns `503 unhealthy` when the DB is disconnected
- JSON 404 and malformed-JSON 400 responses
- CORS allows the configured origin and not others
- Security and rate-limit headers
- Connection-string redaction
- Auth: CSRF, validation, tokens, rate limits, roles, log redaction (`auth.test.js`)
- Scanner (`scanner.policy.test.js`, `scanner.egress.test.js`, `scanner.runner.test.js`): DNS resolution policy and pinning, ZAP report normalization, evidence masking, the score formula, the egress proxy with real local sockets (auth, host/port allowlist, redirects to metadata addresses, CONNECT tunnels, size/request/idle limits), and the Docker runner with a fake `spawn` (argv safety, timeout kill, failures)
- Scans (`scan.test.js`): `Scan` model validation, defaults, immutability, and indexes; URL/source/query/ID validation, including local and private target blocking; sort mapping; 401/403/503/429 behavior of the scan routes

`auth.integration.test.js`, `scan.integration.test.js`, and `scanner.integration.test.js` **need a real MongoDB** (Atlas, `appcheck_test` database). `scanner.integration.test.js` runs the real worker with a **mocked** scanner: state transitions, atomic claiming, failures and timeouts with safe messages, re-validation at execution time, stale-scan recovery, lease checks, findings ownership, and the dashboard summary. The scan integration tests cover record creation, ownership from the session, protected fields, pagination/filtering/sorting, cross-user isolation, invalid and unknown IDs, the per-user creation limit, and that no score or findings are ever fabricated. When the database is unreachable they are reported as **skipped** with the reason, never as passed. Run a single file with `node --test tests/scan.integration.test.js`.

## Troubleshooting

| Symptom | Fix |
| ------- | --- |
| Backend exits with `Invalid environment configuration` | Fix the listed variables in `backend/.env` |
| `querySrv ECONNREFUSED` on startup | Node can't reach a DNS server for the SRV lookup (seen on some Windows setups where Node's resolver uses `127.0.0.1`). Set `DNS_SERVERS=8.8.8.8,1.1.1.1` in `backend/.env`, or use the non-SRV connection string from Atlas. The startup log line `DNS servers for MongoDB lookups` shows which servers were used (`source: "DNS_SERVERS"` or `"system"`). If it says `system`, the setting was not picked up: restart the backend, and make sure `DNS_SERVERS` is not also set (even empty) in your shell, because shell variables take precedence over `.env`. |
| `Could not connect to any servers in your MongoDB Atlas cluster` | Add your current public IP to Atlas *Network Access*; check VPN/firewall for port 27017 |
| `EADDRINUSE` on port 5000 | Another process uses the port. Change `PORT` in `backend/.env` **and** `NEXT_PUBLIC_API_URL` in `frontend/.env.local` |
| Dashboard: "NEXT_PUBLIC_API_URL is not set" | Create `frontend/.env.local` from `.env.example` and restart `npm run dev` |
| "No response from the AppCheck API at …" | The request got no HTTP response. Most often the backend is not running: it **exits at startup** if it cannot reach MongoDB Atlas, so check its terminal (see [DATABASE.md](DATABASE.md#common-errors)). Otherwise check `NEXT_PUBLIC_API_URL`, and that the exact page origin is in `FRONTEND_URL` (`http://localhost:3000` and `http://127.0.0.1:3000` are different origins; the browser console shows a CORS error in that case) |
| URL scan rejected with "must not point to a local, private, or reserved IP address" | Intended: scan targets must be public. `localhost`, private IPs, and internal hostnames are blocked (see [SECURITY.md](SECURITY.md#scan-targets)) |
| Sign-in shows "Temporarily rate limited" | The API returned `429`. Wait for the countdown (it follows `Retry-After`). From one IP, 10 failed sign-ins per 15 minutes are allowed; anonymous requests share 100 per 15 minutes. Restarting the backend clears in-memory counters in development, but do not script repeated logins against your dev backend; run `npm test` instead |
| URL scans stay "Queued" | The scanner is disabled or unavailable. The URL Scan page and `GET /api/v1/scanner/status` give the reason (`URL_SCANNER` not set, Docker not running, or ZAP image not pulled) |
| Scan failed with "The scanner could not complete the scan" | Check the backend log line `URL scan failed` (it has ZAP's output tail). Common causes: the target refused connections, or the container could not reach the egress proxy (on Linux see `SCANNER_PROXY_BIND`) |
| "Too many scan requests" | More than 20 scan records created by your account within 15 minutes; wait and retry |
| "The database is temporarily unavailable" | The API is running but lost its MongoDB connection (`503 DATABASE_UNAVAILABLE`). Nothing was saved; retry once the database is back |
| Dashboard shows Database `disconnected` | API is up but lost its Atlas connection; check backend logs |
| Changed `NEXT_PUBLIC_API_URL` but nothing happens | `NEXT_PUBLIC_*` values are inlined at build/dev start — restart the dev server or rebuild |
