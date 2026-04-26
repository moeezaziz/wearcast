# WearCast Launch Trust Checklist

This checklist is the final trust-and-readiness sweep to run before App Store submission or a public consumer launch.

Related documents:

- [launch-readiness-plan.md](/Users/moeezaziz/Downloads/wearcast/wearcast/docs/launch-readiness-plan.md)
- [phase-1-positioning.md](/Users/moeezaziz/Downloads/wearcast/wearcast/docs/phase-1-positioning.md)
- [app-store-privacy-checklist.md](/Users/moeezaziz/Downloads/wearcast/wearcast/docs/app-store-privacy-checklist.md)
- [privacy.html](/Users/moeezaziz/Downloads/wearcast/wearcast/www/privacy.html)
- [terms.html](/Users/moeezaziz/Downloads/wearcast/wearcast/www/terms.html)
- [support.html](/Users/moeezaziz/Downloads/wearcast/wearcast/www/support.html)

## Public URLs

Before submission, confirm these URLs are public, correct, and stable:

- Privacy Policy URL
- Terms of Use URL
- Support URL

Recommended expectation:

- each page loads without auth
- each page works on mobile
- each page is reachable from inside the app

## In-App Trust Surfaces

Confirm the app exposes:

- Privacy Policy
- Terms of Use
- Support
- account deletion
- clear wording for synced wardrobe data
- clear wording for local-only saved looks

Current in-app touchpoints:

- About section in Settings
- Support row in Settings
- delete-account dialog

## Privacy / Data Accuracy

Before launch, verify these statements are still true:

- GoatCounter is the only analytics provider in production
- there is no ad SDK or tracking SDK
- Google sign-in is still optional, not required
- email verification still uses Resend
- backend hosting still runs through Fly.io
- recommendation requests still go through the WearCast backend
- wardrobe items and wardrobe photos are stored when a signed-in user saves them
- saved looks remain local-only
- account deletion still removes active account and synced wardrobe records

If any of these change, update:

- [privacy.html](/Users/moeezaziz/Downloads/wearcast/wearcast/www/privacy.html)
- [app-store-privacy-checklist.md](/Users/moeezaziz/Downloads/wearcast/wearcast/docs/app-store-privacy-checklist.md)

## App Store Connect Checklist

Before submission:

- Privacy Policy URL entered
- App Privacy answers entered
- privacy answers match the latest implementation
- support contact is valid and monitored
- app description and screenshots do not overclaim features that are not live

## Product Claims Check

Review all launch-facing copy and make sure it does not imply:

- synced saved looks, if saved looks are still local-only
- perfect recommendations
- fully automated closet organization without review
- unsupported monetization features
- unsupported cross-device behavior

## Support Readiness

Before launch:

- support email inbox is monitored
- basic reply templates exist
- common support topics are known
- a bug-report path exists
- privacy and deletion requests have an owner

## Final Manual Test Sweep

Run this just before release:

1. Open Privacy Policy from the app.
2. Open Terms from the app.
3. Open Support from the app.
4. Sign up with email and verify the flow still matches copy.
5. Sign in with Google and verify the flow still matches copy.
6. Add a wardrobe item with a photo.
7. Delete a wardrobe item.
8. Trigger account deletion flow and verify wording is still accurate.
9. Save a look and verify the local-only wording still makes sense.
10. Confirm Settings links and support button work on device.

## Ship Decision

Do not submit until:

- the public URLs are live
- the privacy checklist has been reviewed against the current build
- the support email is monitored
- the delete-account and local-data wording has been verified on device
