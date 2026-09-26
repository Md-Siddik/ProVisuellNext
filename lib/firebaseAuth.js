import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
} from "firebase/auth"
import { api } from "./api"
import { auth } from "./firebaseClient"
import { getCurrentLanguageDict } from "./i18n/apiErrorMessages"
import { no } from "./i18n/locales/no"

const googleProvider = new GoogleAuthProvider()
const microsoftProvider = new OAuthProvider("microsoft.com")

// Where the "Continue" link on Firebase's hosted verification page sends the
// visitor back to. Built from the current origin so it always matches
// wherever the app is actually running (localhost, staging, production).
function verificationActionCodeSettings() {
  return { url: `${window.location.origin}/login` }
}

export async function sendVerificationEmail(user) {
  const target = user || auth.currentUser
  if (!target) return
  await sendEmailVerification(target, verificationActionCodeSettings())
}

// Email/password signup doesn't touch Firebase: the server parks the details
// and emails its own confirmation link, and only creates the Firebase account
// once that link is opened (see app/api/auth/signup). Calling it again for
// the same address sends a fresh link.
export async function signUpWithEmail({ name, email, password, confirmPassword, lang }) {
  return api.public.post("/auth/signup", { name, email, password, confirmPassword, lang })
}

// Step 2 — called by /verify-email with the token from the emailed link.
export async function confirmSignup(token) {
  return api.public.post("/auth/signup/verify", { token })
}

export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  return cred.user
}

export async function loginWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider)
  return cred.user
}

export async function loginWithMicrosoft() {
  const cred = await signInWithPopup(auth, microsoftProvider)
  return cred.user
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email)
}

export async function logout() {
  await signOut(auth)
}

// Human-readable message for the login/signup forms, in whatever language
// is currently selected (see i18n/locales/*.js "authErrors").
// Languages without their own authErrors fall back to Norwegian (the
// required-complete dictionary) instead of failing.
const AUTH_ERROR_KEYS = {
  "auth/invalid-email": "invalidEmail",
  "auth/user-disabled": "userDisabled",
  "auth/user-not-found": "userNotFound",
  "auth/wrong-password": "wrongPassword",
  "auth/invalid-credential": "invalidCredential",
  "auth/email-already-in-use": "emailAlreadyInUse",
  "auth/weak-password": "weakPassword",
  "auth/popup-closed-by-user": "popupClosedByUser",
  // A second click while the popup was opening — same as closing it.
  "auth/cancelled-popup-request": "popupClosedByUser",
  "auth/popup-blocked": "popupBlocked",
  // Only with Firebase's "multiple accounts per email" setting: the email
  // already signs in another way.
  "auth/account-exists-with-different-credential": "accountExistsDifferentCredential",
  "auth/network-request-failed": "networkRequestFailed",
  "auth/too-many-requests": "tooManyRequests",
}

export function friendlyAuthError(err) {
  const key = AUTH_ERROR_KEYS[err?.code || ""]
  const texts = getCurrentLanguageDict().authErrors || no.authErrors
  return (key && (texts[key] || no.authErrors[key])) || texts.generic || no.authErrors.generic
}

// Keeps the real Firebase error in the developer console (users only ever
// see friendlyAuthError). Closing the popup yourself isn't worth logging.
export function logAuthError(err) {
  if (["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(err?.code)) return
  console.error("Sign-in failed:", err?.code || "", err?.message || err)
}
