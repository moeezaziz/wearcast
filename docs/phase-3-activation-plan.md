# WearCast Phase 3 Activation Plan

This document translates Phase 3 of the launch-readiness plan into a concrete onboarding and first-run activation spec.

Related documents:

- [launch-readiness-plan.md](/Users/moeezaziz/Downloads/wearcast/wearcast/docs/launch-readiness-plan.md)
- [phase-1-positioning.md](/Users/moeezaziz/Downloads/wearcast/wearcast/docs/phase-1-positioning.md)
- [app-store-launch-copy.md](/Users/moeezaziz/Downloads/wearcast/wearcast/docs/app-store-launch-copy.md)

## Goal

Get a new user to clear value in under 60 seconds:

1. understand what WearCast does
2. get a recommendation
3. lightly personalize it
4. see why adding a wardrobe makes it better

## Current Flow Audit

Based on the current implementation in [www/app.js](/Users/moeezaziz/Downloads/wearcast/wearcast/www/app.js) and [www/index.html](/Users/moeezaziz/Downloads/wearcast/wearcast/www/index.html):

### What happens now

- app opens directly into the Today tab
- first-time users see a privacy dialog before value
- if no saved location exists, the app may try auto-geo after consent
- otherwise the user must search or tap location
- recommendation arrives only after location is resolved
- wardrobe CTA is present, but appears before a structured activation path
- preference controls exist, but they are not turned into a guided first-run moment

### Current strengths

- fast path exists for returning users
- location-driven recommendation loop already works
- wardrobe CTA is already connected to Today
- auth is not forced on first run

### Current friction

- no explicit welcome moment
- privacy appears before the user understands the benefit
- no guided first recommendation moment
- no lightweight preference onboarding
- no deliberate "now add your wardrobe" step after value
- settings and tuning exist, but first-run does not stage them

## Activation Principles

For launch, first-run should feel:

- immediate
- guided
- low-commitment
- rewarding
- clearly progressive

It should not feel:

- like setup
- like account creation
- like a utility dashboard
- like a closet-management task before value

## Recommended First-Run Flow

### Step 1: Full-screen onboarding deck

Purpose:

- explain the value in one breath

Recommended structure:

1. Promise slide
   - headline: "What to wear today, based on the weather and your closet."
   - subhead: "WearCast turns live weather into a fast outfit recommendation."
2. Speed slide
   - headline: "Get a recommendation in seconds."
   - subhead: "Check today, get dressed faster, and move on with your day."
3. Wardrobe upside slide
   - headline: "Add your wardrobe later for better picks."
   - subhead: "Add a few staples and WearCast starts dressing from what you already own."
4. Action slide
   - primary CTA: "Use my location"
   - secondary CTA: "Search manually"
   - tertiary action: "Skip for now"

Notes:

- this should appear only for first-run users
- do not ask for auth here
- do not show wardrobe complexity here
- this should be a full-screen overlay or deck, not a modified Today card
- the deck must be skippable from every step

### Step 2: Location choice

Purpose:

- get to value quickly

Options:

- primary: "Use my location"
- secondary: "Search for a city"

Microcopy:

- "WearCast uses your location to build a recommendation for today."

Important rule:

- privacy/legal choices should not interrupt before this decision unless required
- if consent handling must appear, it should be collapsed into the location request moment, not a generic blocker

### Step 3: First recommendation

Purpose:

- deliver obvious value immediately

Success state:

- weather hero visible
- recommendation card visible
- loading state feels premium and short

Content priorities:

- "what should I wear"
- one clear rationale
- no clutter from advanced controls

### Step 4: Quick preference tuning

Purpose:

- make the recommendation feel personally relevant

Recommended first-run questions:

1. "Do you usually run cold or warm?"
2. "What kind of day is this?"
   - Everyday
   - Office
   - Active
   - Evening
3. "What look do you want?"
   - Casual
   - Polished
   - Sporty
   - Minimalist

Rules:

- show as a lightweight bottom sheet or card after the first recommendation
- no more than three quick choices
- re-run the recommendation immediately after save

### Step 5: Wardrobe upgrade moment

Purpose:

- connect value to monetizable behavior

Trigger:

- after first recommendation is visible
- after tuning is applied

Message:

- "Want this to use the clothes you already own?"
- "Add 5 staples and WearCast starts building recommendations from your wardrobe."

CTA:

- "Start my wardrobe"

Secondary action:

- "Maybe later"

## What To Change In The Product

### A. Add a first-run onboarding state

Need:

- a simple first-run flag
- onboarding completion flag
- a transient current-slide UI state
- logic to skip for returning users

Suggested state flag:

- `onboarding.completed`
- `onboarding.firstRecommendationSeen`
- in-memory `activeOnboardingSlide`

### B. Re-sequence consent

Current issue:

- privacy dialog appears too early and too generically

Recommended change:

- keep privacy choices accessible and required where needed
- avoid leading with the privacy dialog before the user sees the core value
- tie permission language to the location action itself

### C. Add guided preference setup

Current issue:

- preferences exist as settings/tuning infrastructure, but not as a deliberate activation step

Recommended change:

- create a first-run tuning surface after recommendation #1
- store responses directly into the existing preference model

### D. Turn the wardrobe CTA into a sequenced post-value step

Current issue:

- wardrobe CTA exists, but is not staged after a value moment

Recommended change:

- delay the stronger wardrobe pitch until after:
  - first recommendation
  - or first recommendation + quick tuning

## Proposed UI Changes

### New UI needed

- first-run full-screen onboarding deck
- quick preference onboarding sheet
- "maybe later" wardrobe prompt behavior

### Existing UI to reuse

- Today weather hero
- recommendation card
- existing wardrobe CTA language
- existing preference model
- existing location search and geolocation actions

## Implementation Plan

### Phase 3A: activation scaffolding

Build:

- first-run state flag
- onboarding entry condition
- returning-user bypass

### Phase 3B: welcome + location start

Build:

- welcome screen/card
- clear location entry actions
- cleaner transition from location permission to recommendation loading

### Phase 3C: quick preference tuning

Build:

- post-recommendation tuning sheet
- save to existing prefs model
- immediate recommendation refresh

### Phase 3D: wardrobe post-value prompt

Build:

- staged wardrobe CTA after first recommendation/tuning
- dismiss / snooze behavior
- no auth gate at this stage

## Success Metrics

Phase 3 should be considered successful if it improves:

- first recommendation rate
- time to first recommendation
- preference completion rate
- wardrobe CTA tap rate
- first item add rate

Recommended targets:

- first recommendation rate > 70%
- preference setup completion > 50%
- wardrobe CTA tap rate > 35%
- first wardrobe item add > 20%

## Recommended Next Build Order

1. add onboarding state model
2. add welcome screen
3. re-sequence location + consent behavior
4. add quick preference sheet
5. delay wardrobe CTA until after first recommendation

## Scope Guardrails

Do not add in this phase:

- auth requirements
- paywall logic
- Android-specific onboarding changes
- advanced profile editing
- long multi-step forms

This phase is only about getting users to value faster.
