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

## Faster iOS Simulator Loop

For simulator work, the slow part is usually rebuilding and copying the bundled `www` folder into the native app over and over. A faster loop is:

1. Use the one-command launcher:

```bash
npm run ios:dev
```

That will:
- point Capacitor iOS at `http://127.0.0.1:5173`
- copy the updated config into `ios/App`
- start the live-reload server and keep it running

Then open `ios/App/App.xcworkspace` or `ios/App/App.xcodeproj` in Xcode and run the simulator.

If you want the manual version instead, you can still:

2. Start the local live-reload server for the web app:

```bash
npm run web:serve
```

3. Point Capacitor's iOS Debug app at that local server and copy once:

```bash
npm run ios:dev:copy
```

4. Open `ios/App/App.xcworkspace` or `ios/App/App.xcodeproj` in Xcode and run the simulator.

After that, most `www/` edits should auto-reload in the simulator without a full native rebuild.

When you're done and want the app back on bundled assets:

```bash
npm run ios:dev:disable
npx cap copy ios
```

## Customize
Edit decision rules in `app.js` (function `deriveRecommendation`).

## Privacy
Stores last location + preferences in your browser (`localStorage`).
