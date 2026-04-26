# WearCast Phase 5 Monetization Plan

## Goal

Turn WearCast from a useful product into a launchable subscription business without damaging first-run value.

The rule for this phase is simple:

- the app must feel helpful before it asks for money
- the paid tier must unlock meaningfully better daily utility, not cosmetic upgrades
- free users must still get enough value to trust the product

## Monetization Strategy

WearCast should launch as a `freemium subscription` product.

Free should prove the core loop:

- get a daily recommendation
- tune it lightly
- add a small starter wardrobe
- understand why wardrobe-powered recommendations are better

Premium should unlock the durable value:

- build a real digital closet
- scan freely
- get better recommendations from what you actually own
- treat WearCast like a daily wardrobe assistant, not a novelty utility

## Packaging

### Free

- unlimited weather-based daily recommendations
- lightweight tune controls
- up to `15 wardrobe items`
- up to `3 saved looks`
- up to `5 photo scans per rolling 7 days`
- manual wardrobe entry
- account sync

### Premium

- unlimited wardrobe items
- unlimited photo scans
- wardrobe-powered recommendations as a first-class mode
- unlimited saved looks
- richer recommendation quality over time
- future premium bucket:
  seasonal wardrobe insights
  weekly planning
  closet gap suggestions

## What Actually Gets Gated

Do not gate the basic “what should I wear today?” outcome.

Gate the higher-value “make this truly mine” loop:

- wardrobe scale
- scan volume
- saved-look depth
- the strongest wardrobe-personalized recommendation moments

Recommended launch gates:

1. `Wardrobe item cap`
Free users can save up to 15 items.

2. `Photo scan cap`
Free users can scan up to 5 items per 7 days.

3. `Saved looks cap`
Free users can save up to 3 looks.

4. `Advanced wardrobe-powered recommendation messaging`
Free users can still experience wardrobe-powered recommendations, but premium should be positioned as the way to unlock the full closet and remove limits.

Do not gate:

- first recommendation
- onboarding
- first wardrobe items
- first wardrobe-based “aha” moment

## Pricing

Recommended launch pricing:

- `USD 4.99 / month`
- `USD 49.99 / year`
- annual plan merchandised as the default
- annual includes a `7-day free trial`

Why:

- monthly is low-friction enough for impulse conversion
- annual is meaningfully better value and should carry most paid starts
- annual value framing fits a daily-use product better than a one-time lifetime unlock

## Entitlement Model

Use one premium entitlement only for launch.

Recommended identifiers:

- product ids:
  - `wearcast_ai_premium_monthly`
  - `wearcast_ai_premium_annual`
- entitlement:
  - `premium`

User states:

- `free`
- `premium_active`
- `premium_grace_period`
- `premium_expired`
- `premium_trial`

For launch, the app should mostly reason about:

- `hasPremiumAccess`
- `subscriptionPlan`
- `trialActive`
- `renewalStatus`

## Paywall Triggers

The paywall should appear after value, not before it.

### Primary triggers

1. When user adds the `5th wardrobe item`
Reason:
That is the clearest point where the user has invested effort and is ready to hear the “unlock your full closet” story.

2. When user hits the `15 item` free cap
Reason:
This is the cleanest hard limit and easiest to explain.

3. When user tries to save the `4th saved look`
Reason:
They are showing repeat-use intent.

4. When user hits the weekly `scan cap`
Reason:
They are using the highest-value ingestion path.

### Secondary triggers

1. After `3 successful use days`
Definition:
Three separate days where the user gets a recommendation.

2. After first clearly wardrobe-powered recommendation
This should be a softer premium surface, not a hard block.

### Triggers to avoid

- first app open
- before first recommendation
- before first wardrobe item
- aggressive repeated prompts in the same session

## Paywall UX

The paywall should feel like an upgrade invitation, not a punishment screen.

### Headline direction

- `Unlock your full digital closet`
- `Get outfit picks from your full wardrobe`
- `Save more, scan more, style from what you own`

### Supporting copy

- unlimited wardrobe items
- unlimited scans
- unlimited saved looks
- smarter recommendations from your closet

### Plan merchandising

- annual plan first
- monthly as secondary
- show simple savings framing
- annual plan called out clearly

### Required actions

- start subscription
- restore purchases
- maybe later
- manage subscription from account once subscribed

## Limit Handling Rules

When a user hits a free limit, the app should:

1. explain the limit in one sentence
2. connect it to premium value
3. preserve the user’s work when possible
4. give one clear next action

Examples:

- item cap:
  `Your free closet is full at 15 items. Go premium to keep building your full wardrobe.`
- saved looks cap:
  `Free includes 3 saved looks. Upgrade to keep a larger library of outfits.`
- scan cap:
  `You have used this week’s free scans. Go premium for unlimited wardrobe scans.`

For scan cap specifically:

- keep manual add available
- do not dead-end the user

## Settings / Account Requirements

Phase 5 needs a visible premium state in account surfaces.

Add to Settings / Account:

- current plan
- trial status if relevant
- renewal status if relevant
- restore purchases
- manage subscription
- premium badge / plan label

## Analytics To Add With Monetization

Phase 5 should not ship without event tracking around monetization.

Track:

- `paywall_viewed`
- `paywall_dismissed`
- `paywall_cta_tapped`
- `purchase_started`
- `purchase_succeeded`
- `purchase_failed`
- `restore_started`
- `restore_succeeded`
- `restore_failed`
- `free_limit_hit`
- `trial_started`
- `trial_converted`

Properties to capture where useful:

- trigger source
- paywall variant
- plan selected
- item count
- saved look count
- scan count
- active day count

## Recommended Build Order

### 1. Subscription foundation

- choose StoreKit 2 architecture
- define product ids
- define local entitlement state shape
- define premium helpers such as `hasPremiumAccess()`

### 2. Free limit engine

- wardrobe item cap logic
- saved look cap logic
- scan cap logic
- central guard helpers instead of scattered checks

### 3. Paywall surface

- one reusable paywall modal / screen
- paywall copy for each trigger
- annual-first plan presentation
- restore purchases action

### 4. Purchase flow

- load products
- purchase product
- verify entitlement state
- restore purchases
- handle pending / cancelled / failed flows

### 5. Account and settings integration

- premium badge
- plan details
- restore purchases row
- manage subscription row

### 6. Conversion polish

- softer upgrade surfaces after first wardrobe-powered value
- limit-hit messaging polish
- experiment with trigger timing only after analytics is live

## Suggested Technical Shape

Keep monetization logic centralized.

Recommended modules once implementation starts:

- `subscription state`
- `entitlement helpers`
- `free limit policy`
- `paywall presenter`
- `purchase service`

Even if the code stays in `www/app.js` initially, keep these concepts separated with clearly named sections so we do not bury subscription logic across unrelated UI handlers.

## Success Metrics

Phase 5 is working if:

- paywall view -> purchase start is `8%+`
- purchase start -> paid is `30%+`
- annual is `60%+` of paid starts
- limit-hit paywalls outperform generic prompts
- wardrobe activation does not collapse after monetization ships

## Out Of Scope For Phase 5

Do not build yet:

- lifetime plan
- family plan
- gifting
- referral discounts
- promo code system
- Android billing
- multi-tier premium packages

Launch with one premium tier, one clear story, and one pricing page.
