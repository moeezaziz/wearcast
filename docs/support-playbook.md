# WearCast Support Playbook

This is the lightweight launch support playbook for early consumer release.

Primary support contact:

- `moeezazizch@gmail.com`

## Support Goals

- help users recover quickly
- spot repeated product issues early
- identify launch blockers fast
- keep trust high, especially around account, privacy, and wardrobe data

## Common Support Buckets

### 1. Sign-in and account issues

Examples:

- verification email not received
- Google sign-in failed
- signed in but wardrobe missing
- refresh/session expired unexpectedly

First response goal:

- confirm sign-in method
- confirm which email they used
- ask whether the issue is on web or iPhone app

### 2. Wardrobe upload issues

Examples:

- photo analysis failed
- crop looks wrong
- item saved incorrectly
- duplicate item confusion

First response goal:

- ask for screenshot
- ask whether it was camera or library upload
- ask whether the user was signed in when saving

### 3. Recommendation quality issues

Examples:

- outfit too cold
- outfit too warm
- recommendation too generic
- wardrobe match feels wrong

First response goal:

- ask for city or weather context
- ask whether wardrobe items were added
- ask what they expected instead

### 4. Privacy / deletion requests

Examples:

- delete my account
- remove my data
- how are my photos used

First response goal:

- point user to Privacy Policy
- confirm account email
- if deletion is requested, verify whether they already used in-app deletion

## Triage Priorities

### P0

- users cannot sign in
- users cannot delete account
- wardrobe data appears exposed or mixed between users
- app is broken on launch for many users

### P1

- recommendation service failing
- wardrobe sync failing
- repeated photo-analysis failures
- broken support/privacy/terms links

### P2

- recommendation quality complaints
- copy confusion
- edge-case upload issues
- feature requests

## Response Templates

### Verification email issue

Suggested reply:

"Thanks for reporting this. Please reply with the email address you used, whether you signed up with email or Google, and whether you checked spam/junk. I’ll help you sort it out."

### Recommendation quality issue

Suggested reply:

"Thanks for the feedback. Please send the city or location you used, roughly what the weather was like, and what you expected to wear instead. That helps narrow down whether this is a weather-fit or wardrobe-fit issue."

### Photo upload issue

Suggested reply:

"Thanks for flagging this. If you can, send a screenshot of the result and let me know whether the photo came from the camera or your library. That will help me reproduce the issue."

### Data deletion request

Suggested reply:

"You can delete your account from inside WearCast. If you want help with that or want me to confirm the request path, reply with the email address on the account and I’ll guide you."

## Minimum Logging To Capture During Launch

When a support case comes in, record:

- date
- category
- platform
- signed-in or signed-out
- severity
- summary
- whether it was resolved

This can start as a simple spreadsheet or notes doc.

## Launch Escalation Rule

Pause public promotion if any of these happen:

- multiple sign-in failures in one day
- multiple broken account deletion reports
- wardrobe sync data-loss reports
- recommendation endpoint instability affecting many users

## Weekly Review

During the first weeks after launch, review:

- top 3 support categories
- repeated recommendation complaints
- upload/crop failure patterns
- privacy/account confusion

That review should feed directly into the next product priorities.
