// Ported from Client/src/firebase/firebase.config.js. Firebase's web config
// values are public by design (they identify the project, not a secret), so
// they use NEXT_PUBLIC_ vars — mirroring Vite's VITE_ prefix convention.
import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

// This module is only ever imported from Client Components, but Next.js
// still renders those once on the server for the initial HTML — avoid
// re-initializing the app on every server render/hot-reload, and never
// touch browser-only persistence storage outside the browser.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(app)

if (typeof window !== "undefined") {
  // Explicit local (IndexedDB) persistence — the session must survive a
  // browser/tab restart, not just a reload, without the user signing in again.
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.error("Failed to set auth persistence:", err.message)
  })
}

export default app
