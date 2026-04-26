# WearCast Recommendation Engine Hardening Plan

Created: 2026-04-26

Implementation status: core launch-blocking work implemented on 2026-04-26.

Latest verification:

- Local strict audit: [recommendation-engine-audit-2026-04-26T08-39-58-973Z.json](/Users/moeezaziz/Downloads/wearcast/wearcast/tmp/recommendation-engine-audit-2026-04-26T08-39-58-973Z.json)
- Markdown summary: [recommendation-engine-audit-2026-04-26T08-39-58-973Z.md](/Users/moeezaziz/Downloads/wearcast/wearcast/tmp/recommendation-engine-audit-2026-04-26T08-39-58-973Z.md)
- Result: pass, 18/18 successful, 0 severe red flags, 0 warnings, weather fit 100, stock-image aesthetic 100, uncached p90 6562ms.

Related documents:

- [launch-readiness-plan.md](/Users/moeezaziz/Downloads/wearcast/wearcast/docs/launch-readiness-plan.md)
- [phase-3-activation-plan.md](/Users/moeezaziz/Downloads/wearcast/wearcast/docs/phase-3-activation-plan.md)
- [phase-5-monetization-plan.md](/Users/moeezaziz/Downloads/wearcast/wearcast/docs/phase-5-monetization-plan.md)

Latest audit artifacts:

- [recommendation-engine-audit-2026-04-26T08-05-14-723Z.json](/Users/moeezaziz/Downloads/wearcast/wearcast/tmp/recommendation-engine-audit-2026-04-26T08-05-14-723Z.json)
- [recommendation-value-eval-2026-04-26T08-06-32-074Z.json](/Users/moeezaziz/Downloads/wearcast/wearcast/tmp/recommendation-value-eval-2026-04-26T08-06-32-074Z.json)

## Goal

Make WearCast's core recommendation loop launch-grade:

1. fast enough to feel instant
2. weather-aware enough to trust
3. wardrobe-aware enough to justify adding items
4. visually coherent enough to feel premium
5. measurable enough to keep improving after launch

This is a product-quality plan, not just a model-prompt cleanup. The app wins only if the recommendation feels obviously useful in the moment: "Yes, this is what I should wear today."

## Current Findings

### What is already strong

- Weather API calls are fast after the recent caching work.
- Current-location weather now has a better client strategy: coarse cached location first, fresh fallback second.
- Cached recommendation responses are effectively instant.
- The recommendation output shape is consistent.
- Wardrobe usage is usually high when the wardrobe has relevant items.
- Stock images usually match the right broad category.

### What is not launch-grade yet

- Uncached recommendation generation is often around 6 seconds and can spike much higher.
- Very hot weather can still produce heat-inappropriate office outfits, especially merino, wool, overshirts, or unnecessary umbrellas.
- The current image-match score is too generous because it measures category match, not aesthetic fit.
- Stock image choices collapse too many different garments into the same few visuals.
- Some assets visually contradict the recommendation intent, for example cotton shorts mapping to denim shorts or polished chinos mapping to black trousers.
- Wardrobe usage is not yet measured deeply enough: the app should know whether it used the user's wardrobe because it was appropriate, not merely because an item existed.
- The audit scripts are useful but not yet strict enough to catch the specific failures that matter to users.

## Success Criteria

Before consumer launch, the recommendation loop should meet these thresholds:

- Weather fetch p95 under 800ms from app request to backend response.
- Cached recommendation p95 under 150ms.
- Uncached recommendation p50 under 4s and p90 under 8s.
- Zero severe weather-mismatch failures in the evaluation matrix.
- At least 90% of wardrobe-eligible test cases use one or more appropriate wardrobe items.
- At least 85% stock-image aesthetic score across audited scenarios.
- No hot-weather output above 30C feels-like recommends heavy wool, merino layers, coats, beanies, gloves, or non-rain umbrellas.
- No rain gear unless rain probability, precipitation, or forecast trend clearly justifies it.
- Recommendation card always explains the practical weather reason in plain language.

## Phase 1: Add Deterministic Weather Guardrails

Purpose: prevent obviously wrong recommendations before they reach the user.

### Changes

- Add a weather profile classifier in the backend:
  - hot: feels-like >= 30C
  - very hot: feels-like >= 35C
  - cold: feels-like <= 8C
  - very cold: feels-like <= 0C
  - wet: precip probability >= 45% or current precipitation > 0
  - windy: gusts >= 30 km/h
  - high UV: UV >= 6
- Add forbidden-item rules per profile:
  - very hot forbids wool, merino, thermal, fleece, winter coat, beanie, gloves, heavy overshirt, parka.
  - hot forbids unnecessary outer layers unless rain, wind, commute, or indoor AC context justifies a carry-only layer.
  - dry weather forbids umbrella unless forecast later rain is material.
  - office context should prefer breathable polish, not heavy formal fabric.
- Add a post-generation validator that checks outfit text, item details, and slot reasons.
- If a severe mismatch is detected, retry the model once with a focused correction prompt.
- If retry still fails, apply a deterministic safe fallback outfit.

### Acceptance tests

- Karachi hot office produces no merino, wool, sweater, heavy overshirt, umbrella, beanie, or coat.
- Hot evening/event cases use short sleeves, linen/cotton, polos, lightweight shirting, or no outer layer.
- Rain accessories appear only when rain is actually likely.

## Phase 2: Make Wardrobe Usage Smarter

Purpose: make "from your closet" feel real without forcing bad wardrobe matches.

### Changes

- Normalize wardrobe item categories more aggressively:
  - top, bottom, outer, shoes, accessory
  - subtype, material, warmth, waterproofness, formality, sportiness
- Score each wardrobe item against:
  - weather fit
  - occasion fit
  - style fit
  - user thermal preference
  - color/basic versatility
- Tell the model which wardrobe items are "recommended candidates" and which are "avoid today."
- Add a response field or internal score explaining why a wardrobe item was used or skipped.
- Prefer exact wardrobe photos over stock images when the chosen item came from the wardrobe and has an image.

### Acceptance tests

- A hot day does not use wool-blend trousers unless office formality demands it and the copy explains the tradeoff.
- Rainy commute prioritizes shell jackets and closed shoes if present.
- Empty wardrobes still get a complete outfit.
- Sparse wardrobes use only appropriate items and fill the rest with generic recommendations.

## Phase 3: Improve Recommendation Speed

Purpose: reduce the perceived wait and avoid slow outliers.

### Changes

- Add server-side timing spans for:
  - request validation
  - weather fetch/cache
  - wardrobe normalization
  - model call
  - post-generation validation
  - stock-image matching
- Cache recommendation inputs by stable hash:
  - coarse weather bucket
  - location bucket
  - preference hash
  - wardrobe summary hash
- Add stale-while-revalidate behavior for returning users:
  - show the last known recommendation immediately
  - refresh in background if weather/preference changed
- Shorten model prompt where possible and move hard rules into deterministic code.
- Add a strict timeout and fallback path so the UI never waits indefinitely.

### Acceptance tests

- User sees a useful previous recommendation immediately on repeat opens.
- Fresh recommendation replaces stale content without blocking the app.
- Slow model call produces a graceful fallback with a retry option.

## Phase 4: Add Aesthetic-Aware Stock Image Matching

Purpose: make recommendation visuals feel premium and aligned with the outfit.

### Changes

- Extend stock catalog metadata:
  - warmth
  - formality
  - activity
  - weather tags
  - visual style
  - material cues
  - silhouette
- Replace pure keyword matching with weighted scoring:
  - category match
  - exact subtype match
  - weather compatibility
  - occasion compatibility
  - style compatibility
  - negative penalties
- Add negative rules:
  - do not show sweater/knit imagery for hot weather unless explicitly needed.
  - do not show umbrella imagery for dry conditions.
  - do not show denim shorts for polished cotton/chino shorts if a better asset exists.
  - do not show black tailored trousers for every chino/trouser case once alternate assets exist.
- Add a confidence field to each image match.
- If image confidence is low, prefer a neutral fallback or omit the image for that slot rather than showing a misleading visual.

### New assets needed

- Lightweight crewneck or knit tee
- Beige or navy chinos
- Linen trousers
- Cotton/chino shorts
- Short-sleeve oxford or linen shirt
- Warm-weather polished overshirt or unstructured blazer
- Brown/tan loafers
- Neutral derby/dress shoe
- Lightweight scarf
- Better technical joggers

### Acceptance tests

- "Lightweight chinos" no longer always maps to black trousers.
- "Cotton shorts" no longer maps to denim shorts once a cotton-short asset exists.
- "Fine merino crewneck" never gets shown in very hot weather because the recommendation should be rejected earlier.
- Image aesthetic score is reported separately from category score.

## Phase 5: Strengthen Evaluation Scripts

Purpose: make regressions obvious before release.

### Changes

- Expand `scripts/audit_recommendation_engine.mjs` into three scores:
  - weather correctness
  - wardrobe appropriateness
  - visual/aesthetic alignment
- Add explicit red-flag detectors:
  - hot plus wool/merino/fleece/thermal/coat
  - dry plus umbrella/rain gear
  - cold plus exposed/minimal outfit
  - office plus overly athletic outfit
  - workout plus dress shoes/formal trousers
  - high UV plus no sun guidance when outdoors
- Add a smaller smoke-test matrix for pre-commit/local use.
- Add a larger launch-readiness matrix for release checks.
- Save each audit as JSON plus a short markdown summary.

### Acceptance tests

- Local smoke audit runs quickly enough to use during development.
- Release audit clearly fails on severe weather/style mismatches.
- Audit output includes examples, not just aggregate scores.

## Phase 6: Improve Product Feedback Loop

Purpose: let real users teach us what is wrong after launch.

### Changes

- Add recommendation feedback actions:
  - "Too warm"
  - "Too cold"
  - "Too formal"
  - "Too casual"
  - "Not my style"
  - "Use more of my wardrobe"
  - "This was good"
- Log feedback with:
  - weather profile
  - selected outfit
  - wardrobe usage count
  - image match confidence
  - user preferences
- Use feedback to tune future recommendations locally for that user first, then aggregate later.

### Acceptance tests

- Feedback event is captured.
- The next recommendation can adjust based on "too warm" or "too cold."
- Feedback does not require account creation.

## Phase 7: UI/UX Polish For Trust

Purpose: make the recommendation feel considered, not random.

### Changes

- Show a compact weather reason near the outfit:
  - "Feels like 35C, so we skipped layers."
  - "Rain likely later, so bring a shell."
- If an item is from the user's wardrobe, label it subtly:
  - "From your wardrobe"
- If an item is generic, label it less prominently:
  - "Suggested staple"
- Show a "why this works" section with one concise sentence.
- Avoid showing low-confidence stock images that make the outfit feel wrong.

### Acceptance tests

- A user can understand why the app chose the outfit in under 5 seconds.
- Wardrobe-sourced items are visibly differentiated from generic suggestions.
- Hot-weather recommendations visibly communicate layer-skipping.

## Recommended Execution Order

1. Implement deterministic weather guardrails and retry/fallback logic.
2. Upgrade the audit script so it catches the known failures.
3. Re-run the matrix and verify hot-weather/umbrella failures are gone.
4. Add wardrobe candidate scoring and "used/skipped because" metadata.
5. Add stock-image metadata and aesthetic scoring.
6. Add the missing stock assets or generate a coherent replacement set.
7. Add feedback actions and analytics.
8. Polish UI labels for weather reason, wardrobe source, and confidence.

## Launch Blockers

These must be fixed before a consumer launch:

- Severe hot-weather mismatch.
- Missing timing visibility around slow recommendation outliers.
- No strict failure threshold in recommendation audits.
- Stock image aesthetic score not separated from category score.

These can ship shortly after launch if we are careful:

- Full asset expansion.
- User feedback personalization.
- Advanced wardrobe skip explanations.
- Larger visual-system refresh.

## Product Principle

The recommendation engine should be allowed to be simple, but it must never be obviously wrong.

Users will forgive a basic outfit. They will not forgive an outfit that ignores the weather.
