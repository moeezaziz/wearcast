# WearCast Recommendation Engine Audit

Run: 2026-04-26T08-30-40-170Z

- Base URL: https://localhost:3099
- Pass: no
- Cases: 18/18 successful
- Weather p95 target context: avg 91ms, max 231ms
- Recommendation timing: p50 5827ms, p90 7284ms, max 17699ms
- Weather fit avg: 100
- Profile fit avg: 92
- Wardrobe usage avg: 88
- Stock image category avg: 100
- Stock image aesthetic avg: 98
- Severe red flags: 2
- Warning red flags: 0

## Severe Examples

- Karachi, Pakistan / office_polished / empty: hot_heavy_material - Hot weather includes cold-weather material or accessory.
- Karachi, Pakistan / office_polished / appropriate_capsule: hot_heavy_material - Hot weather includes cold-weather material or accessory.

## Weak Cases

- Dublin, Ireland / everyday_auto / appropriate_capsule: scores {"weatherFit":100,"profileFit":100,"wardrobeUsage":55,"stockImages":100,"stockImageAesthetic":100} outfit {"top":"Long-sleeve Oxford shirt","bottom":"Chinos","outer":"","shoes":"Clean leather sneakers","accessories":["Simple watch"]}
- Karachi, Pakistan / everyday_auto / appropriate_capsule: scores {"weatherFit":100,"profileFit":100,"wardrobeUsage":55,"stockImages":100,"stockImageAesthetic":85} outfit {"top":"lightweight tee","bottom":"cotton shorts","outer":"","shoes":"canvas sneakers","accessories":["cap"]}
- Karachi, Pakistan / office_polished / empty: scores {"weatherFit":100,"profileFit":100,"wardrobeUsage":100,"stockImages":100,"stockImageAesthetic":100} outfit {"top":"lightweight linen shirt","bottom":"tailored cotton trousers","outer":"","shoes":"leather loafers","accessories":["UV-protective sunglasses"]}
- Karachi, Pakistan / office_polished / appropriate_capsule: scores {"weatherFit":100,"profileFit":100,"wardrobeUsage":95,"stockImages":100,"stockImageAesthetic":100} outfit {"top":"White Oxford Shirt","bottom":"Lightweight Chinos","outer":"","shoes":"White Leather Sneakers","accessories":["UV-blocking sunglasses"]}
- Karachi, Pakistan / office_polished / mismatched_capsule: scores {"weatherFit":100,"profileFit":100,"wardrobeUsage":55,"stockImages":100,"stockImageAesthetic":100} outfit {"top":"Short-sleeve linen shirt","bottom":"Lightweight linen trousers","outer":"","shoes":"Leather loafers","accessories":["Sunglasses"]}
