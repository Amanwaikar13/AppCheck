# Architecture

AppCheck is a monorepo with two independently run applications:

- **frontend/** — Next.js (App Router, JavaScript). Runs in the browser and on the Next.js server. Talks to the backend over HTTP only.
- **backend/** — Express REST API. The only component that talks to MongoDB Atlas.

The frontend never connects to the database and never receives database credentials.

## Request flow (Phase 1)

```
Browser (Next.js page /dashboard)
   │  useBackendHealth() → dispatch(checkBackendHealth)
   ▼
Redux Toolkit thunk  ──►  services/healthService.js  ──►  Axios client (baseURL = NEXT_PUBLIC_API_URL)
   │
   │  GET {NEXT_PUBLIC_API_URL}/health   (cross-origin, allowed by CORS)
   ▼
Express app
   pino-http → helmet → cors → express.json → rate limiter (/api/v1)
   → routes/index.js → routes/health.routes.js → controllers/health.controller.js
   → services/health.service.js → config/database.js (mongoose.connection.readyState)
   │
   ▼
JSON report (200 healthy / 503 unhealthy) → Redux state → BackendStatusCard UI
```

Unknown routes fall through to `middleware/notFound.js`; every error ends in `middleware/errorHandler.js`, which returns `{ "error": { "code", "message" } }`.

## Backend structure

```
backend/
├── server.js            Startup: load + validate env, connect MongoDB, listen, graceful shutdown
├── src/
│   ├── app.js           createApp({ config, logger }) — middleware and routes only (no I/O)
│   ├── config/
│   │   ├── env.js       dotenv + Zod validation → frozen config object
│   │   ├── database.js  Mongoose connect/disconnect/status
│   │   └── logger.js    Pino logger with redaction
│   ├── controllers/     HTTP layer: read request, call service, send response (health, auth, scan)
│   ├── services/        Business logic: health report, auth (bcrypt), tokens (JWT), scan records
│   ├── routes/          Routers mounted under /api/v1 (health, auth, scans; each with its rate limiters)
│   ├── middleware/      authenticate, requireRole, csrfProtection, validateBody/Query/Params,
│   │                    requireDatabase, notFound, errorHandler
│   ├── utils/           ApiError, session cookie helpers, duration parsing, redaction,
│   │                    networkTarget (local/private target checks)
│   ├── models/          User, Scan, Finding
│   ├── scanner/         URL scanner: targetPolicy (DNS + pinning), egressProxy (per-scan
│   │                    egress guard), zapRunner (Docker/ZAP), normalize (report -> findings,
│   │                    score), urlScanJob, worker (background claim/heartbeat/recovery)
│   └── validators/      Zod request schemas (register, login, scan create/list/id)
├── scripts/             set-user-role.js (CLI: promote/demote users; no public admin signup)
└── tests/               node:test tests; *.integration.test.js require Atlas
```

`app.js` is kept separate from `server.js` so the app can be tested without opening a port on a fixed number or connecting to a database.

### Scan records (Phase 4)

```
POST /api/v1/scans/url { url }
  → csrfProtection → authenticate (sets req.user) → per-user create limiter
  → validateBody(createUrlScanSchema)  (http/https only, no credentials, no local/private targets)
  → scan.controller.createUrlScan → scan.service.createScan(req.user._id, { type, target })
  → Scan.create(...)  status "queued", score/findings/startedAt/completedAt null
  → 201 { scan, notice }

GET /api/v1/scans?type&status&sort&page&limit
  → authenticate → validateQuery → scan.service.listScans(req.user._id, query)
  → Scan.find({ userId, type?, status? }).sort(allowlisted + _id).skip().limit()  +  countDocuments
  → 200 { items, pagination, filters, sort }

GET /api/v1/scans/:id
  → authenticate → validateParams (24 hex) → Scan.findOne({ _id, userId }) → 200 { scan } | 404
```

### URL scan execution (Phase 5)

```
POST /scans/url ── validate text ── resolve DNS (all answers public?) ── Scan{status: queued}
                                                                              │
worker (in the API process, every 5 s, only if URL_SCANNER=zap-docker and Docker+ZAP available)
  findOneAndUpdate(queued -> running, lockedBy, heartbeatAt)      atomic claim, 1 scan at a time
  resolveTarget(url)               re-validate at execution; pin one public address
  startEgressProxy(host, pinned)   127.0.0.1:<random>, per-scan credentials
  docker run zaproxy/zap-stable zap-baseline.py -t URL ... -z "<route all traffic via proxy>"
      ZAP ──HTTP/CONNECT──> egress proxy ──(only target host, pinned IP)──> target
  normalizeZapReport(report.json) -> findings (dedupe per rule), counts, baseline score
  Finding.insertMany + Scan{status: completed, findingsCount, severityCounts, securityScore}
  on any error: Scan{status: failed, errorCode, errorMessage (client-safe)}; proxy always closed
```

- A heartbeat is written every 30 s. Every few minutes, scans with no heartbeat for 25 minutes are marked `failed` (`SCAN_INTERRUPTED`), not retried. Graceful shutdown marks the current scan interrupted immediately.
- Availability (`docker version`, `docker image inspect`) is re-checked about every minute. While unavailable, scans stay `queued`, and `GET /scanner/status` reports the reason.
- `createApp({ services })` takes `resolveTarget` and `scannerStatus`, so tests run without DNS or Docker. The worker is started only by `server.js`.
- Source scans are not executed.

### Startup sequence

1. `loadEnv()` reads `backend/.env` and validates it. On failure the process prints which variables are wrong (never their values) and exits with code 1.
2. `connectDatabase()` connects with Mongoose and pings the server. On failure the process logs a credential-free error and exits with code 1.
3. `User.init()`, `Scan.init()`, and `Finding.init()` build the indexes.
4. The scan worker starts: it fails interrupted scans, checks scanner availability, and begins polling if enabled.
5. Only then does the HTTP server start listening and log `AppCheck API ready`.
6. `SIGINT`/`SIGTERM` close the HTTP server, stop the worker, then close the database connection.

### Request pipeline

`pino-http` → `helmet` → `cors` (credentialed allowlist) → `express.json` → global rate limit → `csrfProtection` (unsafe methods) → routes. Auth routes add their own rate limiter, `validateBody`, and `requireDatabase`; protected routes use `authenticate` (and `requireRole` where needed). Scan routes run `authenticate` for every request, then (for creation) a per-user rate limiter, then `validateBody` / `validateQuery` / `validateParams`. Express 5 makes `req.query` read-only, so parsed query and path values are placed on `req.validated`.

If the database drops **after** startup, Mongoose reconnects automatically and `/api/v1/health` reports `503 unhealthy` until it is back.

## Frontend structure

```
frontend/src/
├── app/
│   ├── layout.js          Root layout: fonts, StoreProvider
│   ├── page.js            Landing page (/), own header/footer
│   ├── (auth)/            /login and /register with a centered layout
│   └── (app)/             Route group requiring sign-in (no URL segment)
│       ├── layout.js      AuthGate + AppShell
│       ├── loading.js     Skeleton loading state
│       ├── error.js       Error boundary with retry
│       ├── dashboard/     Overview dashboard (/dashboard): live recent scans + sample metrics
│       ├── url-scan/      Record a URL scan request
│       ├── source-scan/   Record a source scan request (project name only)
│       ├── scans/         Scan history; scans/[id]/ is the scan detail page
│       └── findings/, reports/, settings/
│                          Placeholder pages
├── components/
│   ├── layout/            AppShell, Sidebar (grouped nav, version/environment footer), NavLinks,
│   │                      Header (breadcrumbs, API status, account), MobileNav, AccountMenu,
│   │                      Brand, PublicNav (landing page session state)
│   └── ui/                Design system: Button, Card, Badge (+ LiveDataBadge, SampleDataBadge),
│                          SeverityBadge, StatTile/StatGroup, DataTable (TanStack), Pagination,
│                          FormField, Select, Checkbox, Feedback (Spinner, Skeleton, EmptyState,
│                          Alert, ErrorState), PageHeader, Icon
├── features/
│   ├── auth/              authSlice (Redux), AuthGate, LoginForm, RegisterForm, validation
│   ├── dashboard/         ScanActivityCard (live), SecurityScoreCard, SeverityChart, RecentActivity,
│   │                      SampleDataNotice, mockDashboardData.js (sample data)
│   ├── settings/          AccountCard (profile from /auth/me, sign out)
│   ├── scans/             scansSlice (Redux), URL/source forms, ScanHistory, ScanDetail (polls
│   │                      while queued/running), ScanResults, FindingsList, ScannerStatusNotice
│   └── health/            healthSlice (Redux), BackendStatusCard, BackendStatusIndicator
├── hooks/                 useBackendHealth, useAuth, useSignOut
├── lib/                   config, navigation, severity, format, safeRedirect
├── services/              Axios client and API services
└── store/                 makeStore() and the client-side StoreProvider
```

Pages are Server Components by default; anything using Redux, hooks, or browser APIs is marked `"use client"`.

Notes:

- **Navigation** is defined once in `lib/navigation.js`; the sidebar, mobile drawer, and header page title all read from it.
- **Design tokens** live in `app/globals.css` (`@theme`): `brand-*` (indigo accent), `navy-*` (sidebar and auth panel), `canvas` (workspace background), `severity-*` (critical, high, medium, low, info), `rounded-card`, `shadow-card`, `shadow-popover`. Components use these utilities instead of raw colors. All status pills are `Badge`; all buttons are `Button`/`ButtonLink` (primary, secondary, ghost, danger).
- **Page anatomy**: the header shows breadcrumbs (`lib/navigation.js#getBreadcrumbs`); each page starts with `PageHeader` (h1, description, actions).
- **Severity colors** are theme tokens (`--color-severity-*` in `globals.css`), validated as a palette for color-vision deficiency. Severity is always shown with a text label, never by color alone.
- **Live vs. sample data**: the dashboard reads one `GET /scans/summary`. With **no scan records**, every dashboard section shows one consistent sample dataset (`features/dashboard/mockDashboardData.js`: 24 scans, score 78, findings 2/5/12/18/7), a "You are viewing a sample dashboard" notice, and a **Sample data** badge on each section; sample rows are not links. With scans but **none completed**, scan activity and recent activity are live and only the score and severity cards show labeled sample data. Once a scan completes, everything is live. Sample data is never stored or mixed into a live section.
- **Scan state** lives in `features/scans/scansSlice.js`: the history query (page, limit, type, status, sort), the current history page, the dashboard's recent scans, and the detail record. Each request slot keeps its `requestId` so an older, slower response cannot overwrite a newer one. Creating a scan marks cached lists stale; sign-in, registration, and sign-out reset the slice.
- **Server-side sorting**: `DataTable` accepts controlled `sorting` / `onSortingChange` (TanStack `manualSorting`). Scan History maps column sorting to the API `sort` parameter, so sorting, filtering, and paging all happen in MongoDB.
- **Backend health** is read by both the header indicator and the status card. `useBackendHealth` returns the server-rendered "checking" state until hydration finishes, so a card that hydrates after the request completes does not cause a hydration mismatch.
- **DataTable** opts out of the React Compiler (`"use no memo"`) because TanStack Table state is read through builder methods the compiler cannot track.
