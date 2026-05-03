# WearCast App Store Privacy Checklist

This document translates WearCast's current implementation into a practical App Store privacy submission checklist for App Store Connect.

Primary reference:

- [App privacy details on the App Store](https://developer.apple.com/app-store/app-privacy-details/)

Additional local references:

- [privacy.html](/Users/moeezaziz/Downloads/wearcast/wearcast/www/privacy.html)
- [terms.html](/Users/moeezaziz/Downloads/wearcast/wearcast/www/terms.html)
- [support.html](/Users/moeezaziz/Downloads/wearcast/wearcast/www/support.html)
- [server/routes/auth.js](/Users/moeezaziz/Downloads/wearcast/wearcast/server/routes/auth.js)
- [server/routes/wardrobe.js](/Users/moeezaziz/Downloads/wearcast/wearcast/server/routes/wardrobe.js)
- [server/index.js](/Users/moeezaziz/Downloads/wearcast/wearcast/server/index.js)
- [www/app.js](/Users/moeezaziz/Downloads/wearcast/wearcast/www/app.js)

## Working Assumptions

This checklist reflects the app as it exists now.

It assumes:

- GoatCounter is enabled in production only after analytics consent.
- PostHog may be enabled in production for product analytics and subscription-funnel measurement only after analytics consent.
- email/password and Google sign-in are both enabled.
- wardrobe items and wardrobe photos are synced when a user is signed in.
- saved looks and verified signed StoreKit subscription state are synced when a user is signed in.
- recommendation and photo-analysis requests go through the WearCast backend.

This document is meant to reduce submission risk, but the final App Store Connect answers should still be reviewed carefully before submission.

## High-Level Recommendation

### Tracking

Recommended answer:

- `No`, WearCast does not currently appear to track users across apps or websites owned by other companies for advertising purposes.

Reasoning:

- current analytics includes GoatCounter and optional PostHog product analytics
- no ad SDKs are present
- no attribution / retargeting stack is visible

### Privacy links required in App Store Connect

Need to provide:

- Privacy Policy URL
- optional Privacy Choices URL if desired later

Recommended current URLs:

- Privacy Policy: public URL for `privacy.html`
- Support: public URL for `support.html`

## Likely Data Types To Disclose

Below is the practical submission view, not a legal definition.

### Contact Info

Likely to disclose:

- `Email Address`

Why:

- email/password sign-up
- account login
- email verification
- support contact flows

Likely linked to user:

- `Yes`

Likely used for:

- App Functionality
- Account Management
- Developer Communications

### User Content

Likely to disclose:

- `Photos or Videos`
- `Other User Content`

Why:

- wardrobe photos
- care-tag photos
- wardrobe metadata such as item names, notes, and care instructions

Likely linked to user:

- `Yes` for synced wardrobe/account content

Likely used for:

- App Functionality
- Product Personalization

### Identifiers

Likely to disclose:

- `User ID`

Why:

- authenticated account records
- backend user table
- session and wardrobe ownership

Likely linked to user:

- `Yes`

Likely used for:

- App Functionality
- Account Management

### Usage Data

Likely to disclose:

- `Product Interaction`

Possibly disclose:

- `Advertising Data`: `No`
- `Other Usage Data`: only if specifically retained and used beyond basic interaction analytics

Why:

- GoatCounter usage analytics
- local product-validation metrics in settings / tab dwell tracking
- recommendation feedback interactions

Likely linked to user:

- GoatCounter: likely not meaningfully linked in the same way as account data
- local product metrics: primarily on device

Conservative submission suggestion:

- disclose `Product Interaction`

Likely used for:

- Analytics

### Location

Likely to disclose:

- `Coarse Location`

Potential question:

- whether `Precise Location` is collected

Current recommendation:

- if the app sends raw device coordinates off-device to fetch weather, review whether Apple's form expects this as precise or coarse location
- based on the current implementation and product framing, plan for at least `Coarse Location`

Likely linked to user:

- if tied to signed-in usage or persisted with account behavior, possibly yes
- if only used transiently and not retained server-side, linkage may be narrower

Conservative submission suggestion:

- disclose location collection if using device location in production

Likely used for:

- App Functionality
- Product Personalization

### Diagnostics

Current recommendation:

- Disclose diagnostics if production Sentry/client error reporting is enabled.

Why:

- the current app can initialize browser Sentry from runtime config
- the backend can initialize Sentry from environment configuration
- `/api/client-log` can receive client-side error reports and recent local event context

Likely data types:

- `Crash Data`
- `Performance Data` if Sentry performance monitoring or timing diagnostics are enabled
- `Other Diagnostic Data` for client/server error reports

Likely linked to user:

- `No` for anonymous diagnostics where no account identifier is attached
- `Yes` if diagnostics include account context for signed-in users

## Data Types Probably Not Needed Right Now

Unless implementation changes before launch, these do not currently look necessary:

- Health & Fitness
- Financial Info
- Sensitive Info categories beyond wardrobe/user content
- Browsing History
- Purchases
- Contacts
- Search History as a separate category beyond functional place-search input
- Contact List
- Device ID for tracking

## Mapping By Feature

### Email / password account

Files:

- [server/routes/auth.js](/Users/moeezaziz/Downloads/wearcast/wearcast/server/routes/auth.js)

Data involved:

- email address
- password hash
- account name
- refresh tokens / session data

Submission impact:

- Contact Info: Email Address
- Identifiers: User ID

### Google sign-in

Files:

- [server/routes/auth.js](/Users/moeezaziz/Downloads/wearcast/wearcast/server/routes/auth.js)
- [www/app.js](/Users/moeezaziz/Downloads/wearcast/wearcast/www/app.js)

Data involved:

- email address
- Google account identifier
- name
- avatar URL

Submission impact:

- Contact Info: Email Address
- Identifiers: User ID
- Possibly Name, if App Store Connect disclosure is needed based on stored profile name

### Wardrobe sync

Files:

- [server/routes/wardrobe.js](/Users/moeezaziz/Downloads/wearcast/wearcast/server/routes/wardrobe.js)
- [server/db.js](/Users/moeezaziz/Downloads/wearcast/wearcast/server/db.js)

Data involved:

- wardrobe item names
- item types
- color/material/care metadata
- favorites
- photos and cropped photos

Submission impact:

- User Content: Photos or Videos
- User Content: Other User Content
- Identifiers: User ID

### Recommendation engine

Files:

- [server/index.js](/Users/moeezaziz/Downloads/wearcast/wearcast/server/index.js)
- [www/app.js](/Users/moeezaziz/Downloads/wearcast/wearcast/www/app.js)

Data involved:

- weather context
- location context
- wardrobe summary
- style and comfort preferences
- recommendation feedback

Submission impact:

- Location
- Product Interaction
- User Content / personalization context where applicable

### Analytics

Files:

- [www/index.html](/Users/moeezaziz/Downloads/wearcast/wearcast/www/index.html)
- [www/app.js](/Users/moeezaziz/Downloads/wearcast/wearcast/www/app.js)

Data involved:

- page views
- app interaction events
- local settings dwell metrics

Submission impact:

- Usage Data: Product Interaction

## Suggested App Store Connect Answers

This is the most conservative practical starting point for submission review.

### Data Used to Track You

Recommended:

- `None`

### Data Linked to You

Recommended likely inclusions:

- Email Address
- User ID
- Photos or Videos
- Other User Content
- Coarse Location

### Data Not Linked to You

Recommended likely inclusions:

- Product Interaction

Note:

- if analytics implementation changes, revisit this before submission

## Submission Checklist

Before App Store submission, confirm each item:

- public Privacy Policy URL is live
- Terms of Use URL is live
- Support URL is live
- App Store Connect privacy answers match the latest implementation
- no new SDKs were added without checking privacy impact
- no tracking or ads SDKs were introduced
- location disclosure was re-reviewed based on exact device-coordinate handling
- wardrobe photo storage behavior still matches the privacy policy
- account deletion behavior still matches the privacy policy

## Known Follow-Ups

These upcoming changes will require updating this checklist:

- adding a subscription SDK or StoreKit-backed purchase analytics
- adding richer product analytics
- adding push notifications
- adding outfit-saving or look-history features
- changing how wardrobe photos are stored or retained

## Bottom Line

If WearCast were submitted today, the safest privacy-label posture is:

- no tracking
- disclose account/contact data
- disclose wardrobe photo and wardrobe content data
- disclose location usage
- disclose product-interaction analytics

Before final submission, revisit this checklist after any analytics, monetization, or crash-reporting work lands.
