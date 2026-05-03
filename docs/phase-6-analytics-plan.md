# WearCast Phase 6 Analytics Plan

## Goal

Give WearCast a launch-ready analytics baseline so we can understand activation, retention, and monetization after release.

Phase 6 starts with instrumentation inside the app before we add a heavier analytics stack. The immediate job is to make the core funnel measurable and keep the event vocabulary stable enough to map into a future tool like PostHog or Amplitude.

## What Is Live Now

The app now tracks a launch funnel in `www/app.js` and sends events through a small analytics abstraction: local diagnostics always, plus GoatCounter and PostHog when configured and analytics consent is enabled.

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
- `saved_look_limit_hit`
- `server_limit_hit`
- `subscription_snapshot_synced`
- `wardrobe_payoff_viewed`
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

- GoatCounter remains the lightweight baseline destination.
- PostHog is the launch-grade funnel destination when `POSTHOG_KEY` is configured and product analytics consent is enabled.
- Dashboard definitions for D1, D7, churn, and experiments still need to be maintained outside the repo.
- Server-side subscription state is synced from signed StoreKit transactions verified by the backend.

## Next Analytics Step

After this baseline, the next upgrade should be dashboard and cohort maintenance inside PostHog.

When that lands, map the current event names forward instead of renaming them casually. Keeping the naming stable will make launch learning much easier.

## Recommended Follow-Up

1. Build a simple launch dashboard for first recommendation rate, first wardrobe item rate, 5-item completion, paywall view to purchase start, purchase start to paid, and D1/D7 retention.
2. Add recommendation quality feedback with optional negative text input.
3. Add experiment naming conventions before testing paywall variants.
