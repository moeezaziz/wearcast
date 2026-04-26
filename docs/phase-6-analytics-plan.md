# WearCast Phase 6 Analytics Plan

## Goal

Give WearCast a launch-ready analytics baseline so we can understand activation, retention, and monetization after release.

Phase 6 starts with instrumentation inside the app before we add a heavier analytics stack. The immediate job is to make the core funnel measurable and keep the event vocabulary stable enough to map into a future tool like PostHog or Amplitude.

## What Is Live Now

The app now tracks a first-pass launch funnel in `www/app.js` and sends events through the existing GoatCounter hook while also keeping a short local event history for debugging.

Current event coverage includes:

- `first_open`
- `session_started`
- `onboarding_viewed`
- `onboarding_skipped`
- `onboarding_completed`
- `location_permission_requested`
- `location_permission_granted`
- `location_permission_failed`
- `location_search_started`
- `location_search_succeeded`
- `location_search_failed`
- `weather_requested`
- `first_recommendation_generated`
- `first_wardrobe_powered_recommendation`
- `activation_tune_viewed`
- `activation_tune_completed`
- `activation_tune_skipped`
- `recommendation_feedback_tapped`
- `wardrobe_prompt_viewed`
- `wardrobe_prompt_tapped`
- `wardrobe_prompt_dismissed`
- `first_wardrobe_item_added`
- `five_wardrobe_items_added`
- `saved_look_added`
- `paywall_viewed`
- `paywall_dismissed`
- `paywall_cta_tapped`
- `purchase_started`
- `purchase_succeeded`
- `purchase_failed`
- `purchase_cancelled`
- `purchase_pending`
- `restore_started`
- `restore_succeeded`
- `restore_failed`
- `trial_started`
- `trial_converted`
- `auth_dialog_opened`
- `auth_started`
- `auth_completed`
- `auth_failed`
- `auth_verification_required`
- `free_limit_hit`

## Why This Matters

This is enough to answer the first launch questions:

- Are new users reaching a recommendation?
- Are they choosing location or manual search?
- Are they completing the quick-tune step?
- Are they adding wardrobe items after value?
- Which free limits are driving upgrade intent?
- Are people viewing the paywall but not starting checkout?
- Are purchase starts turning into active premium?

## Important Limitations

This is still a baseline, not the final analytics stack.

- GoatCounter is still the main live event destination.
- Events are good for funnel counting, not deep cohort analysis.
- There is no dashboard layer yet for D1, D7, churn, or experiment analysis.
- There is no server-side warehouse or user-level subscription reporting yet.

## Next Analytics Step

After this baseline, the next upgrade should be a real product analytics platform such as PostHog or Amplitude.

When that lands, map the current event names forward instead of renaming them casually. Keeping the naming stable will make launch learning much easier.

## Recommended Follow-Up

1. Add an analytics provider abstraction so GoatCounter and a future analytics SDK can both receive the same event payloads.
2. Add a small internal debug surface in Settings that shows the most recent tracked events on-device.
3. Add recommendation quality feedback with optional negative text input.
4. Build a simple launch dashboard for first recommendation rate, first wardrobe item rate, 5-item completion, paywall view to purchase start, purchase start to paid, and D1/D7 retention.
