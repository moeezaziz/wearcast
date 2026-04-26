# WearCast Recommendation Engine Audit

Run: 2026-04-26T08-34-09-054Z

- Base URL: https://localhost:3099
- Pass: no
- Cases: 18/18 successful
- Weather p95 target context: avg 132ms, max 351ms
- Recommendation timing: p50 5669ms, p90 8500ms, max 21290ms
- Weather fit avg: 100
- Profile fit avg: 93
- Wardrobe usage avg: 88
- Stock image category avg: 100
- Stock image aesthetic avg: 100
- Severe red flags: 1
- Warning red flags: 0

## Severe Examples

- Karachi, Pakistan / office_polished / empty: very_hot_layering - Very hot weather includes unnecessary upper-body layering.

## Weak Cases

- Dublin, Ireland / everyday_auto / appropriate_capsule: scores {"weatherFit":100,"profileFit":100,"wardrobeUsage":55,"stockImages":100,"stockImageAesthetic":100} outfit {"top":"Long-sleeve Oxford shirt","bottom":"Chinos","outer":"","shoes":"Clean leather sneakers","accessories":["Simple watch"]}
- Karachi, Pakistan / everyday_auto / appropriate_capsule: scores {"weatherFit":100,"profileFit":100,"wardrobeUsage":55,"stockImages":100,"stockImageAesthetic":100} outfit {"top":"lightweight tee","bottom":"cotton shorts","outer":"","shoes":"canvas sneakers","accessories":["cap"]}
- Karachi, Pakistan / office_polished / empty: scores {"weatherFit":100,"profileFit":100,"wardrobeUsage":100,"stockImages":100,"stockImageAesthetic":100} outfit {"top":"lightweight linen shirt","bottom":"tailored cotton trousers","outer":"","shoes":"leather loafers","accessories":["UV-protective sunglasses"]}
- Karachi, Pakistan / office_polished / mismatched_capsule: scores {"weatherFit":100,"profileFit":100,"wardrobeUsage":55,"stockImages":100,"stockImageAesthetic":100} outfit {"top":"Short-sleeve linen shirt","bottom":"Lightweight linen trousers","outer":"","shoes":"Leather loafers","accessories":["Sunglasses"]}
