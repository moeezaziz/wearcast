# WearCast

WearCast helps you decide what to wear today with weather-smart outfit recommendations that get better as you add your own wardrobe.

- Weather: **Open‑Meteo** (no API key)
- Location search / reverse geocode: **OpenStreetMap Nominatim**
- Backend: **Fly.io** Node/Express API for auth, synced wardrobe, saved looks, AI recommendations, and photo analysis
- Accounts: email/password and Google sign-in
- Premium: StoreKit subscriptions with synced entitlement state, free limits, and purchase restore/manage flows
- Analytics: GoatCounter baseline plus optional PostHog funnel analytics, both gated by product analytics consent

## Run

### Web app

```bash
npm run web:serve
```

Then open:

- http://127.0.0.1:5173

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
Recommendation rules and UI live primarily in `www/app.js`; backend recommendation, scan, auth, saved-look, and wardrobe APIs live in `server/`.

## Privacy
WearCast stores local preferences and diagnostics on device when functional storage is enabled. Signed-in users can sync wardrobe items, wardrobe photos, saved looks, account data, verified StoreKit subscription state, and related metadata through the backend. GoatCounter and PostHog only receive product analytics events after analytics consent is enabled.
