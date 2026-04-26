# WearCast Incident Runbook

## Goal

Give WearCast a simple launch-era playbook for the failures most likely to hurt users during beta and early public rollout.

This runbook is intentionally lightweight. It is designed for fast diagnosis and calm response, not perfect enterprise process.

## First Response Rules

1. Confirm scope before changing anything.
2. Check `/api/health` and `/api/ready`.
3. Grab at least one `X-WearCast-Request-Id` from a failing request if the issue is API-related.
4. Look at the latest backend logs for the matching request id or event name.
5. Prefer feature degradation over full outage when possible.

## Core Checks

Use these first:

- `GET /api/health`
  - confirms process is alive
  - shows uptime, memory, and ML queue state

- `GET /api/ready`
  - confirms service readiness
  - checks DB reachability when configured

- Fly checks
  - `fly checks list`
  - verify the `http_service` readiness check is green

## Incident Types

### 1. App Down Or Routing Failing

Symptoms:

- app not loading
- Fly health checks failing
- requests timing out before app logic runs

Check:

- `/api/health`
- `/api/ready`
- recent deploys
- Fly Machine state

Likely causes:

- deploy boot failure
- bad environment variable
- readiness endpoint failing
- port binding/startup issue

Immediate action:

- rollback if the failure started right after deploy
- if health is green but readiness is red, inspect DB or startup dependency failure

### 2. Auth Failure

Symptoms:

- sign in fails
- refresh loops
- users get signed out unexpectedly

Check:

- `/api/ready`
- `/api/auth/me` response behavior
- backend logs around refresh token or JWT validation

Likely causes:

- auth env var mismatch
- DB issue
- refresh token expiry/revocation issue

Immediate action:

- verify auth secrets are present and unchanged
- if limited to Google auth, keep email auth available and message users accordingly

### 3. Weather Provider Failure

Symptoms:

- weather fetch errors
- recommendation cannot start because weather is missing

Check:

- `/api/weather`
- logs for Open-Meteo and MET Norway fallback failures

Likely causes:

- upstream provider outage
- network timeout
- malformed provider response

Immediate action:

- confirm both providers are failing before escalating
- if fallback still works, do not treat as full outage

### 4. Recommendation Failure

Symptoms:

- Today screen loads weather but no recommendation appears
- `/api/recommend` returns 500
- recommendation latency spikes badly

Check:

- `/api/recommend`
- logs for `recommend` start, AI fallback, parse fallback, and fatal events
- memory usage from `/api/health`

Likely causes:

- OpenRouter failure
- bad model response shape
- prompt regression
- memory pressure

Immediate action:

- confirm whether fallback recommendations are still serving
- if AI path is failing but fallback path works, treat as degraded service not total outage

### 5. Wardrobe Photo Analysis Failure

Symptoms:

- scans fail repeatedly
- item extraction returns nothing
- analyze endpoint becomes slow

Check:

- `/api/analyze-item-photo`
- memory and ML queue state from `/api/health`
- logs with `requestId`

Likely causes:

- heavy ML memory pressure
- background removal failure
- upstream model failure
- malformed image payloads

Immediate action:

- encourage manual add flow if scan path is degraded
- watch queue depth and memory before scaling or restarting

## User-Facing Fallback Rules

- If weather works but AI styling is degraded, keep fallback recommendations live.
- If scans are unstable, keep manual wardrobe entry available and point support there.
- If premium restore is failing, avoid telling users to repurchase until logs confirm entitlement state.

## After The Incident

Capture:

- what users saw
- affected surfaces
- first detection time
- request id examples
- root cause
- fix applied
- whether a launch checklist item should change

## Launch Recommendation

This runbook is good enough for beta and soft launch. Before a broader push, pair it with:

- Sentry for frontend and backend
- Fly alerting tied to health checks
- one short rollback checklist
