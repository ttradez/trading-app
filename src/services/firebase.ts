import { Platform } from 'react-native';
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

// Don't crash if env is unset (e.g. a contributor without .env) —
// warn loudly instead. Auth/Firestore calls will fail at use-time
// with a clear Firebase error rather than a blank-screen boot crash.
const missing = Object.entries(firebaseConfig)
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length > 0) {
  // eslint-disable-next-line no-console
  console.warn(
    `[firebase] Missing EXPO_PUBLIC_FIREBASE_* env vars: ${missing.join(
      ', ',
    )}. Auth/Firestore will not work until .env is set and Metro is restarted with --clear.`,
  );
}

const app = initializeApp(firebaseConfig);

let _auth: Auth;
if (Platform.OS === 'web') {
  // Browser: localStorage persistence is automatic
  _auth = getAuth(app);
} else {
  // Native: persist auth tokens via AsyncStorage so the user stays signed in
  // across app restarts. getReactNativePersistence isn't in the public TS types
  // (it's exported from firebase/auth's RN entry only), so we require() to
  // bypass the type-only check.
  const { getReactNativePersistence } = require('firebase/auth');
  _auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

export const auth = _auth;
export const db   = getFirestore(app);
