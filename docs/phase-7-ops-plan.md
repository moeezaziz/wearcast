# WearCast Phase 7 Operational Safety Plan

## Goal

Make WearCast launch-safe enough that production issues are visible, diagnosable, and recoverable.

Phase 7 is about moving from "we can ship" to "we can operate." The first step is observability we control directly, followed by a proper alerting and crash-reporting stack.

## What Is Live Now

The app now has a first operational safety baseline across frontend and backend.

### Backend

Implemented in `server/index.js`:

- `GET /api/health`
  - lightweight liveness endpoint
  - returns uptime, memory usage, request id, and ML queue state

- `GET /api/ready`
  - readiness endpoint
  - checks database reachability when `DATABASE_URL` is configured
  - returns `503` when the service is not ready

- `POST /api/client-log`
  - accepts frontend crash/error reports
  - logs them with request ids and recent client analytics context

- API request observability
  - every API response now includes `X-WearCast-Request-Id`
  - API requests are logged with method, path, status, duration, ip, and user agent

- process safety logs
  - unhandled promise rejections are logged
  - uncaught exceptions are logged

### Frontend

Implemented in `www/app.js`:

- global `window.error` reporting
- global `unhandledrejection` reporting
- client error events sent to `/api/client-log`
- recent analytics events included with crash reports for better debugging context
- optional Sentry browser initialization via runtime config when `SENTRY_BROWSER_DSN` is set

### Sentry

Implemented in `server/index.js` and `www/app.js`:

- optional backend Sentry initialization when `SENTRY_DSN` is set
- optional browser Sentry initialization when `SENTRY_BROWSER_DSN` is set
- server-side capture for readiness failures, key API fatal paths, client error relays, and process-level crashes

Recommended environment variables:

- `SENTRY_DSN`
- `SENTRY_BROWSER_DSN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_RELEASE`

## Why This Matters

This gives us the minimum viable launch ops loop:

- we can tell whether the server is alive
- we can tell whether it is actually ready to serve traffic
- API failures now carry a request id that can be traced in logs
- client-side crashes have somewhere to go instead of disappearing silently

That is a meaningful improvement over the previous state, where debugging depended mostly on ad hoc console output.

## What Is Still Missing

This is not the final launch ops stack yet.

- no Sentry or equivalent crash reporting dashboard
- no Fly or external alerting wired to health/readiness failures
- no p95 latency dashboard
- no structured log aggregation destination
- no operational admin UI
- no incident checklist for recommendation-provider degradation

## Recommended Next Phase 7 Work

1. Add Sentry for `www/app.js` and `server/index.js`.
2. Configure Fly health checks and uptime monitoring against `/api/health` and `/api/ready`.
3. Add alerting for:
   - readiness failures
   - repeated 5xx responses
   - elevated memory usage
   - recommendation generation failures
4. Create a short incident runbook for:
   - auth outage
   - weather provider outage
   - OpenRouter outage
   - wardrobe photo analysis failures
5. Add one internal ops checklist for every deploy:
   - health endpoint green
   - readiness endpoint green
   - recommendation endpoint returns valid response
   - StoreKit paywall loads
   - auth still works

Implementation note:

- Fly runtime readiness checks now target `/api/ready` from `fly.toml`
- incident handling guidance now lives in `docs/incident-runbook.md`

## Launch Recommendation

Do not call operational safety done yet. Call it "baseline in place."

This baseline is enough to support a small beta or soft launch. Before a broader public push, WearCast should still add Sentry, health-check alerting, and a simple incident runbook.
