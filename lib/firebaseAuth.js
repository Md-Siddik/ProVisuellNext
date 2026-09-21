import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
  updateProfile,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
} from "firebase/auth"
import { auth } from "./firebaseClient"
import { getCurrentLanguageDict } from "./i18n/apiErrorMessages"

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

export async function signUpWithEmail(name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  if (name) {
    await updateProfile(cred.user, { displayName: name })
  }
  // Real Firebase verification link — the account stays unverified (and
  // AuthContext withholds the application profile/access) until the visitor
  // clicks it.
  await sendVerificationEmail(cred.user)
  return cred.user
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
export function friendlyAuthError(err) {
  const code = err?.code || ""
  const key = {
    "auth/invalid-email": "invalidEmail",
    "auth/user-disabled": "userDisabled",
    "auth/user-not-found": "userNotFound",
    "auth/wrong-password": "wrongPassword",
    "auth/invalid-credential": "invalidCredential",
    "auth/email-already-in-use": "emailAlreadyInUse",
    "auth/weak-password": "weakPassword",
    "auth/popup-closed-by-user": "popupClosedByUser",
    "auth/network-request-failed": "networkRequestFailed",
    "auth/too-many-requests": "tooManyRequests",
  }[code]
  const dict = getCurrentLanguageDict()
  return (key && dict.authErrors?.[key]) || dict.authErrors.generic
}
