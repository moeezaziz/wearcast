# WearCast Launch Execution Checklist

## Goal

Turn the launch-readiness plan into a practical pre-release checklist for beta, App Store submission, and soft launch.

This checklist is the bridge between "the product is built" and "we are ready to ship it to real people."

## Beta Gate

Before inviting a beta cohort:

- onboarding deck works cleanly on fresh install
- location permission flow works on device
- manual city search still works if location is denied
- first recommendation renders successfully
- quick-tune flow reruns recommendation correctly
- first wardrobe item add works from both empty state and Today CTA
- wardrobe photo scan works on-device
- auth works for email and Google
- premium paywall opens from the expected triggers
- StoreKit products load on device with real App Store Connect products configured
- restore purchases works on a test account
- `/api/health` returns healthy
- `/api/ready` returns healthy

## App Store Submission Gate

Before submitting to App Review:

- Privacy Policy URL is public and final
- Terms URL is public and final
- Support URL is public and final
- App Store privacy labels match the live implementation
- screenshot copy does not overclaim unreleased features
- subscription copy matches actual pricing and trial behavior
- annual and monthly product ids exist in App Store Connect
- subscription review notes explain premium limits and restore flow
- account deletion path works

## Soft Launch Gate

Before public release:

- Sentry DSNs configured for backend and browser
- Fly readiness check is green in production
- recommendation endpoint returns a valid response in production
- wardrobe scan path works in production
- at least one support inbox flow is monitored daily
- launch KPIs have an owner and review cadence

## First-Week Launch Review

Check daily:

- first recommendation rate
- first wardrobe item add rate
- five-item wardrobe completion rate
- paywall view to purchase start
- trial start to paid conversion
- client crash volume
- backend 5xx volume
- recommendation failure rate

## What Is External To The Repo

These still require operational work outside the codebase:

- App Store Connect products and metadata
- TestFlight / beta cohort recruitment
- Sentry project creation and DSN provisioning
- Fly monitoring and alert routing
- App Store screenshots captured from real devices or simulator
