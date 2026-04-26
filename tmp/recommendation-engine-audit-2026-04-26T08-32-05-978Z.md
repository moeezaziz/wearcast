# WearCast Recommendation Engine Audit

Run: 2026-04-26T08-32-05-978Z

- Base URL: https://localhost:3099
- Pass: yes
- Cases: 18/18 successful
- Weather p95 target context: avg 29ms, max 81ms
- Recommendation timing: p50 4ms, p90 6ms, max 14ms
- Weather fit avg: 100
- Profile fit avg: 92
- Wardrobe usage avg: 88
- Stock image category avg: 100
- Stock image aesthetic avg: 98
- Severe red flags: 0
- Warning red flags: 0

## Severe Examples

- None

## Weak Cases

- Dublin, Ireland / everyday_auto / appropriate_capsule: scores {"weatherFit":100,"profileFit":100,"wardrobeUsage":55,"stockImages":100,"stockImageAesthetic":100} outfit {"top":"Long-sleeve Oxford shirt","bottom":"Chinos","outer":"","shoes":"Clean leather sneakers","accessories":["Simple watch"]}
- Karachi, Pakistan / everyday_auto / appropriate_capsule: scores {"weatherFit":100,"profileFit":100,"wardrobeUsage":55,"stockImages":100,"stockImageAesthetic":85} outfit {"top":"lightweight tee","bottom":"cotton shorts","outer":"","shoes":"canvas sneakers","accessories":["cap"]}
- Karachi, Pakistan / office_polished / mismatched_capsule: scores {"weatherFit":100,"profileFit":100,"wardrobeUsage":55,"stockImages":100,"stockImageAesthetic":100} outfit {"top":"Short-sleeve linen shirt","bottom":"Lightweight linen trousers","outer":"","shoes":"Leather loafers","accessories":["Sunglasses"]}
