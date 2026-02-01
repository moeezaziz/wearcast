# What to Wear (local-first)

A tiny webapp that suggests what to wear based on local weather (temperature, feels-like, wind, humidity, cloud cover, precipitation, UV).

- Weather: **Open‑Meteo** (no API key)
- Location search / reverse geocode: **OpenStreetMap Nominatim**
- No backend, no accounts

## Run

### Option A: open directly
Open `index.html` in a browser.

> Note: Some browsers restrict geolocation or service workers on `file://` URLs.

### Option B (recommended): run a local server
From the `what-to-wear/` folder:

```bash
python3 -m http.server 5173
```

Then open:

- http://localhost:5173

## Customize
Edit decision rules in `app.js` (function `deriveRecommendation`).

## Privacy
Stores last location + preferences in your browser (`localStorage`).
