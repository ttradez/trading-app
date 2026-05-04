# Pocket Trade — Setup Guide

## Prerequisites

- Node.js 18+ / npm
- Python 3.11+
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- A [Railway](https://railway.app) account
- A [Firebase](https://console.firebase.google.com) project
- A [Google AdMob](https://admob.google.com) account
- Apple Developer account (iOS publishing)
- Google Play Console account (Android publishing)

---

## 1. Firebase

1. Go to [Firebase Console](https://console.firebase.google.com) → Create project → **Pocket Trade**
2. Add an **iOS** app and an **Android** app
3. Enable **Authentication** → Sign-in methods: Email/Password, Google, Apple
4. Enable **Firestore Database** (production mode, then update rules)
5. Copy your web app config keys into `.env`:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
```

---

## 2. Railway (backend)

1. Push the `backend/` folder to a GitHub repo
2. In Railway: New Project → Deploy from GitHub → select repo
3. Set environment variable: `DATABASE_URL` is not needed (SQLite is file-based)
4. Note your Railway public URL and put it in `.env`:

```env
EXPO_PUBLIC_API_URL=https://your-app.railway.app
```

---

## 3. Historical Data (run once before deploying)

### Daily data (Stooq — indexes + futures)

```bash
cd backend/data_pipeline
pip install pandas pandas-datareader
python fetch_stooq.py
```

Outputs CSV files to `backend/data/daily/`.

### Intraday data (Kaggle CC0 — ES + NQ)

1. Download the dataset from:  
   https://www.kaggle.com/datasets/cesarecastro/cleaned-spy-and-qqq-1-minute-data
2. Extract `clean_SPY.csv` and `clean_QQQ.csv` into `backend/data_pipeline/raw/`
3. Run:

```bash
python fetch_kaggle_intraday.py
```

Outputs CSV files to `backend/data/intraday/`.

> **Note:** The intraday CSVs can be large (hundreds of MB). Do not commit them to git. They are loaded into the SQLite database at server startup.

---

## 4. AdMob

1. Create an AdMob account at https://admob.google.com
2. Create an **Interstitial** ad unit for iOS and another for Android
3. Replace the placeholder in `src/services/adService.ts`:

```ts
: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX'
```

4. Add your AdMob App ID to `app.json` under the `react-native-google-mobile-ads` plugin config.

---

## 5. IAP ($5 CAD — Remove Ads)

1. In App Store Connect: create a **Non-Consumable** in-app purchase with product ID `remove_ads`
2. In Google Play Console: create a **One-time product** with the same product ID `remove_ads`
3. The product ID is already hardcoded in `src/services/iapService.ts` as `remove_ads`

---

## 6. Running Locally

```bash
# Frontend
npm install
npx expo start

# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

---

## 7. Building for Stores

```bash
# Configure EAS
eas build:configure

# iOS build
eas build --platform ios

# Android build
eas build --platform android

# Submit to stores
eas submit --platform ios
eas submit --platform android
```
