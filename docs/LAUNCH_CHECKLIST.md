# Pip launch checklist

Everything needed to submit to the iOS App Store and Google Play.
Items I (the AI) finished tonight are checked off. The unchecked
ones require your accounts, credentials, or a device.

**Estimated total time for the unchecked items: 4-8 hours of
focused work spread across 2-3 days.**

---

## ✅ Code & config (done tonight)

- [x] iOS Info.plist usage descriptions for camera, photos, notifications, Apple sign-in
- [x] iOS Privacy Manifest declared in app.json (required iOS 17+)
- [x] Android `permissions` array declared
- [x] Build numbers + version codes set
- [x] EAS production + preview profiles wired
- [x] App version synced across app.json + package.json (1.0.2)
- [x] Backup PNGs moved out of `assets/` bundle path
- [x] Cross-device responsiveness fixed for Samsung / Pixel / budget Android
- [x] Tab bar nav-bar inset Platform-aware
- [x] KeyboardAvoidingView Android behavior fixed in all 4 modals
- [x] Privacy Policy drafted: `docs/PRIVACY_POLICY.md`
- [x] Terms of Service drafted: `docs/TERMS_OF_SERVICE.md`
- [x] Legal-doc URLs wired into Settings + Disclaimer (`src/config/legalDocs.ts`)
- [x] babel.config.js strips console.* from production bundles
- [x] Crashlytics SDK facade + initialization wired in App.tsx
- [x] Railway Procfile + runtime.txt + db.py env var
- [x] Slim-DB script (`backend/data_pipeline/slim_db_for_prod.py`)
- [x] Store listing copy written (`docs/STORE_LISTING.md`)

---

## ❌ You must do — BLOCKERS

### 1. Deploy backend to Railway  ⏱ 30-60 min

Follow `backend/DEPLOY_RAILWAY.md` step by step. Steps:
1. Sign up at railway.app
2. New project from this GitHub repo, root = `backend/`
3. Attach 2 GB volume at `/data`
4. Set env var `POCKET_TRADE_DB_PATH=/data/pocket_trade.db`
5. Locally run `python data_pipeline/slim_db_for_prod.py` to produce
   `backend/pocket_trade_slim.db` (~2-3 GB after VACUUM)
6. Upload that file to the Railway volume
7. Verify `/health` and `/markets` respond
8. **Copy the Railway URL** and paste it as the new value in
   `src/config/chartBackend.ts`

### 2. Push legal docs to GitHub Pages  ⏱ 15 min

The Settings + Disclaimer links point at
`https://GITHUB_USER.github.io/trading-app/PRIVACY_POLICY`. Make that
real:

1. Push this repo to GitHub (public is easiest; private works but
   requires extra Pages config)
2. Settings → Pages → Source: `main` branch, `/docs` folder → Save
3. Wait 2-3 minutes for GitHub to publish
4. Visit `https://YOUR_USERNAME.github.io/trading-app/PRIVACY_POLICY`
   to confirm it renders
5. Open `src/config/legalDocs.ts` and replace `GITHUB_USER` with your
   actual GitHub username
6. Reload the app, tap Settings → Privacy Policy → confirm it opens

### 3. Apple Developer setup  ⏱ 20 min + 24h enrollment wait

If you don't already have an Apple Developer account:
1. Sign up at https://developer.apple.com/programs/ ($99/year)
2. Wait for Apple's identity verification (24-48 hours typically)

Once enrolled:
1. https://appstoreconnect.apple.com → Apps → **+** → New App
2. Platform: iOS, Name: **Pip**, Primary Language: English,
   Bundle ID: **com.pockettrade.app** (must match app.json exactly),
   SKU: any unique string like `pip-2026-06`
3. After creation, copy the **Apple ID** number (a long digit string
   like `6450123456`) from App Information
4. Paste it into `eas.json` → `submit.production.ios.ascAppId`
   replacing the `REPLACE_WITH_...` placeholder

### 4. Google Play Developer setup  ⏱ 30 min + 24h wait

1. Sign up at https://play.google.com/console (one-time $25)
2. Identity verification typically completes within 24 hours
3. Create app: name **Pip**, default language English, app/game **App**,
   free, accept declarations
4. Generate a service-account key:
   - Cloud Console → IAM & Admin → Service Accounts → Create
   - Name it `pip-play-publisher`
   - Grant role "Service Account User"
   - Click the account → Keys tab → Add Key → JSON → download
5. Place the downloaded JSON at `trading-app/play-store-service-account.json`
   (already in .gitignore — won't be committed)
6. In Play Console → Setup → API access → link the service account
   you just created

### 5. Firebase Crashlytics setup  ⏱ 15 min

1. https://console.firebase.google.com → select `pocket-trade-prod`
2. In the left sidebar: Crashlytics → Get started → enable for
   both iOS and Android
3. Add the iOS app to the Firebase project (Bundle ID
   `com.pockettrade.app`) if not already added → download
   `GoogleService-Info.plist` → place at `trading-app/GoogleService-Info.plist`
4. Add the Android app (Package `com.pockettrade.app`) if not already
   added → download `google-services.json` → place at
   `trading-app/google-services.json`
5. Install the native modules:
   ```
   npx expo install @react-native-firebase/app @react-native-firebase/crashlytics
   ```
6. Add to `app.json` → `expo.plugins`: `"@react-native-firebase/app"` and
   `["@react-native-firebase/crashlytics", { ... }]`

After the next production build, force a test crash via the dev
console to confirm reports flow through to the Crashlytics dashboard.

### 6. Install babel-plugin-transform-remove-console  ⏱ 1 min

```
cd C:\Users\benti\trading-app
npm install --save-dev babel-plugin-transform-remove-console
```

Without this the production build will fail (the plugin is
referenced in `babel.config.js`).

### 7. Build and side-load on Android (verify cross-device fixes)  ⏱ 20 min

```
cd C:\Users\benti\trading-app
eas build --profile preview --platform android
```

When it finishes, install the APK on:
- A real Samsung Galaxy if you have one, OR
- Android Studio's AVD emulator with a Pixel 4a or Galaxy Nexus
  profile (free, runs on Windows)

Smoke-test:
1. Bottom action row on chart — Sell/Buy/Next Bar labels all visible
2. Custom seek modal — doesn't clip edges
3. Tab bar — not floating above or hidden under Android nav bar
4. PreTradeModal — open keyboard, both stop + target inputs reachable
5. Watchlist — pills render correctly

---

## ❌ You must do — IMPORTANT (before submission)

### 8. Capture marketing screenshots  ⏱ 1-2 hr

See `docs/STORE_LISTING.md` "Screenshot guidance" section. 6 each
for iOS + Android.

### 9. Generate the App Store icon variations

App Store Connect auto-generates everything from the 1024×1024
`assets/icon.png` you already have. Just upload it during the
"App Information" step.

### 10. Fill the Google Play Data Safety form  ⏱ 30 min

Paste-by-paste from `docs/STORE_LISTING.md` "Data Safety form"
section into the corresponding Play Console form.

### 11. Apple privacy nutrition label  ⏱ 15 min

Same idea — Apple's version is in App Store Connect under App
Privacy. Copy from the same STORE_LISTING.md section.

### 12. Run a full production EAS build for both platforms

```
eas build --profile production --platform all
```

Wait for both binaries to finish.

### 13. Submit  ⏱ 10 min each

```
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

EAS handles the rest: signing, uploading the IPA to App Store
Connect, uploading the AAB to Play Console internal-testing track.

### 14. Open the App Store review submission

App Store Connect → My Apps → Pip → Submit for Review.

### 15. Promote the Play Store build to Production track

Play Console → Production → New release → use the build from EAS
→ rollout 100%.

---

## After submission

- **iOS first review**: 24-48 hours typical, sometimes longer for
  finance-category apps. Almost always one rejection round —
  Apple is meticulous about clarifying "this is simulated, no real
  brokerage." If rejected, address feedback and resubmit; usually
  approved on the second pass.
- **Google Play first review**: 7-10 days now (used to be much
  faster). One rejection round is possible.

Total realistic timeline from "submit" to "live in stores":
- iOS: **3-5 business days**
- Android: **7-14 days**

---

## Maintenance after launch

- Watch Crashlytics daily for the first week
- Watch backend logs in Railway dashboard
- Set up GitHub repository issues for bug reports
- Plan a v1.1 release ~2 weeks after launch with whatever bugs
  surfaced + small UX polish from real user feedback
