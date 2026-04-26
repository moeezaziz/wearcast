# WearCast Launch Readiness Plan

## Launch Readiness Read

WearCast already has the bones of a real consumer product. The core loop is compelling: check today's weather, get a styled recommendation, improve it with your own wardrobe, and gradually build a closet the app can use. The product feels much closer to "launchable premium utility" than "side project."

The strongest parts today are:

- A clear core use case: weather-aware outfit decisions.
- A stronger second-order value prop: recommendations from your own closet.
- A surprisingly polished mobile UI and wardrobe flow.
- Real account, sync, image analysis, and recommendation infrastructure.

The biggest issue is that the app is not yet launch-ready as a business, even if it is increasingly launch-ready as software. The gaps are not mostly "more features." They're trust, focus, retention design, monetization design, and operational readiness.

## What The App Is Right Now

If I reduce the product to its real current shape, WearCast is:

"A mobile app that gives daily weather-based outfit recommendations, and becomes more useful when you add items from your wardrobe."

That is a good product foundation. But to launch successfully, we need to sharpen it into a narrower promise:

"WearCast helps you get dressed faster with weather-smart outfit picks from the clothes you already own."

That positioning matters because right now the app risks feeling like three products at once:

- weather utility
- closet organizer
- AI styling tool

For launch, it should feel like one product with one hero outcome:

- "Open app -> see what to wear today -> trust it -> come back tomorrow."

## What’s Good Enough To Launch

- Today screen concept
- Wardrobe ingestion direction
- Auth and wardrobe sync
- iOS shell and mobile UX ambition
- Recommendation engine architecture
- Photo-first wardrobe capture

## What Is Not Good Enough Yet

- Docs and legal pages are materially out of sync with reality
- No monetization system or premium packaging
- Weak analytics for product decisions
- No visible crash/error/support layer
- No explicit onboarding path to first value
- No strong retention mechanic beyond "open again tomorrow"
- No clear consumer pricing story
- Too much complexity before the value is proven
- Huge code concentration in a few files means shipping risk is high

## Critical Launch Gaps

### 1. Positioning Is Not Focused Enough

The app should launch around one use case and one audience, not "everyone who gets dressed."

Best launch audience:

- urban iPhone users
- style-aware but not fashion-expert
- care about weather, commute, and looking intentional
- likely 22-40
- likely professionals, students, city commuters

Best launch promise:

- "Know what to wear today, based on the weather and your closet."

### 2. Onboarding Still Doesn't Guarantee Fast First Value

The UX is better than before, but the app still asks users to understand too much too early. For consumer launch, users must hit value in under 60 seconds.

Current risk:

- users may think they need to build a wardrobe before the app is useful
- wardrobe capture is still effortful
- auth is better deferred, but the path still needs a clearer "why now"

We need a launch onboarding that does this:

1. Get location
2. Show one good recommendation
3. Ask 2-3 lightweight preference questions
4. Offer wardrobe setup as the upgrade to better results

### 3. Trust / Compliance Is Not Launch Ready

This is the biggest red flag in the repo.

Examples:

- `README.md` still describes a no-backend local-only app.
- `www/privacy.html` says hosting is GitHub Pages and mentions GoatCounter always-on analytics, but the app now uses backend auth, Fly hosting, wardrobe storage, email verification, and AI/recommendation infrastructure.
- The About copy in `www/index.html` says AI by Gemini, while the backend currently uses OpenRouter in `server/index.js`.

For a consumer app, especially one handling accounts, wardrobe photos, and AI processing, that mismatch is not acceptable.

Need before launch:

- accurate Privacy Policy
- Terms of Service
- support email / contact flow
- clear account deletion wording
- clear statement on what photos are stored, where, and why
- clear statement on analytics and processors
- clear App Store privacy labels

### 4. No Monetization Strategy Exists In Product Form Yet

There's no paywall, no entitlements, no premium packaging, no pricing logic, and no purchase restoration flow.

That means the app may be product-interest ready, but not revenue ready.

### 5. No Real Product Analytics Stack

GoatCounter is not enough for launching and iterating a consumer subscription app.

We need event analytics for:

- first open
- location permission granted/denied
- first recommendation generated
- wardrobe CTA tapped
- first item added
- 5th item added
- first "recommendation from wardrobe"
- recommendation feedback tapped
- auth started/completed
- paywall viewed
- trial started
- conversion
- D1/D7 retention cohorts

Without that, we won't know what to fix after launch.

### 6. No Operational Safety Net

For a real launch:

- crash reporting
- backend health monitoring
- latency/error monitoring
- image-analysis failure logging
- support triage
- manual admin visibility into auth/recommendation failures

Right now the app feels engineered by logs, not operated like a live product.

## My Recommended Launch Business Model

Do not launch as a pure free app.

Best model: `freemium subscription`

### Free tier

- unlimited daily weather recommendations
- basic style tuning
- up to 15 wardrobe items
- 3 saved looks
- manual wardrobe entry
- limited photo scans per week

### Premium tier

- unlimited wardrobe items
- unlimited photo scans
- wardrobe-powered recommendations
- saved look history
- recommendation tuning memory
- seasonal wardrobe insights
- priority / higher-quality AI recommendations
- future features: packing lists, weekly outfit planning, closet gaps

### Pricing

- `USD4.99/month`
- `USD49.99/year`
- default merchandised plan: annual
- 7-day free trial on annual after user has seen value

Why this works:

- The product has daily/weekly utility, so subscription fits.
- Weather-only recommendations are too weak to charge for.
- "Your closet + better daily looks" is the monetizable wedge.

## Where To Put The Paywall

Not on first open.

Best paywall triggers:

- after user adds 5 wardrobe items
- after first wardrobe-based recommendation
- when user hits free item cap
- when saving the 4th look
- after 3 successful use days

The user must first feel:

"This is actually helping me get dressed."

## Concrete Launch Plan

### Phase 1: Narrow The Product For Launch

Goal: turn WearCast into one clear consumer promise.

Ship decisions:

- Launch as `iPhone-first`
- Position around `Today + Your Wardrobe`
- De-emphasize settings-heavy flexibility
- Cut anything that feels like a utility side quest

Product message:

- hero line: "What to wear today, based on the weather and your closet."
- secondary line: "Add a few staples and get sharper daily looks from what you already own."

### Phase 2: Fix Trust And Consumer Readiness

This is mandatory before launch.

Ship:

- rewrite `www/privacy.html`
- add Terms of Service page
- update About copy in `www/index.html`
- update `README.md` to match actual architecture
- create support/contact entry in app
- add "Report a problem" and "Send feedback"
- define data retention policy for wardrobe photos and account data
- define processor list accurately

Success criterion:

- a user, reviewer, or App Review person can understand what data is collected and why

### Phase 3: Redesign First-Run Activation

Goal: first value in under 60 seconds.

Recommended first-run:

1. Full-screen, skippable onboarding slide deck with one clear promise
2. Location permission from the final onboarding slide
3. Instant recommendation
4. Quick preference setup:
   - usually cold / hot
   - everyday / office / active
   - polished / casual / sporty / minimalist
5. soft wardrobe CTA:
   - "Want this to use clothes you actually own?"

Do not open with:

- auth
- wardrobe complexity
- too many controls
- too many dialogs

Product rule:

- onboarding should live in its own skippable full-screen flow
- the Today screen should stay focused on daily use, not carry onboarding copy or transitional UI

Success metrics:

- 70%+ of new users get first recommendation
- 35%+ tap wardrobe CTA
- 20%+ add first item

### Phase 4: Make Wardrobe Setup Feel Magical

This is your monetization hinge.

Need to tighten:

- first item add
- multi-photo review
- "needs review" handling
- progress feedback
- visible payoff after 3-5 items

Add:

- wardrobe completion meter tied to recommendation quality
- "Add these next" suggestions
- one-tap starter templates
- clearer "now using your closet" moment in Today

Success metrics:

- 40%+ of wardrobe starters add 3 items
- 25%+ add 5 items
- 50%+ of 5-item users view a wardrobe-based recommendation

### Phase 5: Add Real Monetization

Build:

- StoreKit subscriptions
- entitlement model
- free limits
- premium paywall
- annual-first pricing page
- restore purchases
- subscription/trial logic
- premium settings/account state

Best premium copy:

- "Unlock your full digital closet"
- "Unlimited items, unlimited scans, smarter recommendations"

Success metrics:

- paywall to trial start: 8-12%
- trial to paid: 30-40%
- overall visitor to paid can be low early; activation quality matters more first

Implementation note:

- Monetization spec is now captured in `docs/phase-5-monetization-plan.md`
- Recommended build order: entitlement model -> free limits -> paywall surfaces -> StoreKit purchase flow -> restore/manage subscription -> premium account state

### Phase 6: Add Product Analytics And Feedback Loops

Install a real event system such as PostHog or Amplitude.

Track:

- onboarding funnel
- wardrobe activation funnel
- recommendation feedback
- session frequency
- feature usage
- paywall funnel
- churn signals

Also add:

- in-app "Was this useful?" prompt
- thumbs up/down on recommendation quality
- optional text feedback after negative rating

This matters because your biggest post-launch problem will not be building features. It will be understanding why people do or don't come back.

Implementation note:

- Analytics baseline is now captured in `docs/phase-6-analytics-plan.md`
- Current app-level instrumentation lives in `www/app.js`
- Next upgrade after this baseline should be a real analytics backend such as PostHog or Amplitude

### Phase 7: Add Operational Safety

Before public launch:

- crash reporting
- backend error tracking
- alerting for auth/recommendation/photo-analysis failures
- p95 latency dashboard
- admin runbook for incidents
- image-processing fallback policy

At minimum:

- Sentry for app + backend
- health checks and alerting on Fly
- structured logs for critical flows

Implementation note:

- Operational safety baseline is now captured in `docs/phase-7-ops-plan.md`
- Current baseline includes `/api/health`, `/api/ready`, `/api/client-log`, API request ids, API request logs, frontend global error reporting, and optional Sentry wiring
- Remaining launch-critical work is alerting, dashboarding, live beta validation, and launch execution

## What I Would Not Build Before Launch

- Android
- social features
- outfit sharing network
- complicated wardrobe taxonomy
- deep fashion editorial content
- too many recommendation modes
- advanced analytics dashboards for users
- packing lists and calendar planning

Those are good later features, but not needed to prove the business.

## Recommended MVP Launch Scope

Launch with exactly this:

- iPhone app
- weather-based recommendation
- basic style/comfort tuning
- wardrobe add flow with photo scan + manual fallback
- wardrobe-based recommendations
- saved looks
- account + sync
- premium subscription with free limits
- privacy/terms/support
- analytics + crash reporting

That is enough for a meaningful paid launch.

## 90-Day Concrete Plan

### Weeks 1-2: Trust + launch framing

- Rewrite privacy policy and add terms
- Add support/report feedback
- Update app copy and metadata to one clear promise
- Define free vs premium packaging
- Instrument analytics events

### Weeks 3-4: Activation

- Redesign first-run onboarding
- Simplify first recommendation path
- Make wardrobe CTA more explicit after first value
- Improve first 5-item setup experience

### Weeks 5-6: Monetization

- Implement subscriptions and entitlements
- Build paywall and free limits
- Add restore purchases and account/premium state
- Add paywall triggers tied to real value moments

### Weeks 7-8: Stability

- Add Sentry / monitoring / alerting
- Harden photo-analysis and auth failure states
- Test edge cases across onboarding, sync, and wardrobe ingestion
- Create support playbook

### Weeks 9-10: Launch prep

- App Store screenshots and copy
- onboarding polish
- premium merchandising polish
- beta cohort with 30-100 users
- fix top 5 drop-off points from analytics

### Weeks 11-12: Public launch

- soft launch
- monitor activation, retention, trial start, conversion
- iterate copy/paywall/onboarding weekly

## Launch KPIs

These are the numbers I'd use to judge if the launch is working:

### Activation

- first recommendation rate > 70%
- first wardrobe item add > 20%
- five-item wardrobe completion > 15%

### Retention

- D1 > 35%
- D7 > 15%
- 4-week returning use from activated users > 10%

### Monetization

- paywall view to trial > 8%
- trial to paid > 30%
- annual plan share > 60% of paid starts

### Product quality

- recommendation positive feedback > 65%
- wardrobe scan success > 80%
- crash-free sessions > 99%

## Bottom Line

WearCast is not far from being a real launch candidate, but the next work should not be "more product ideas." It should be disciplined launch work: sharpen the promise, reduce onboarding friction, make wardrobe setup feel rewarding, add subscriptions, and fix trust/compliance/analytics gaps.
