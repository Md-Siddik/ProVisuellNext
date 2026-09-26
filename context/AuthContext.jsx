"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/lib/firebaseClient"
import { ACCOUNT_BLOCKED_EVENT, ACCOUNT_BLOCK_CODES, api } from "@/lib/api"
import { logout } from "@/lib/firebaseAuth"

const AuthContext = createContext(null)

// Google/Microsoft accounts already carry a provider-verified identity —
// only a password account can be unverified.
function isPasswordAccount(fbUser) {
  return Boolean(fbUser?.providerData?.some((p) => p.providerId === "password"))
}

// Accounts created through our own signup link (/api/auth/signup) stay
// "unverified" in Firebase — the server knows they were confirmed and says
// so by answering /auth/sync. A 403 "Email not verified" is its "no".
async function syncProfile(fbUser) {
  try {
    const { user, access } = await api.post("/auth/sync", {
      name: fbUser.displayName || "",
      phone: fbUser.phoneNumber || "",
    })
    return { profile: user, access, verified: true }
  } catch (err) {
    if (err.rawMessage === "Email not verified") return { profile: null, access: null, verified: false }
    // Banned / deleted by the Super Admin: no profile, and the caller signs out.
    if (ACCOUNT_BLOCK_CODES.includes(err.code)) return { profile: null, access: null, verified: true, blocked: err.code }
    // Only the server's explicit "Email not verified" means unverified. A
    // network hiccup must not send an already-verified account (whose
    // Firebase flag may be false — see /api/auth/signup) back through
    // verification; the API still rejects any genuinely unverified caller.
    console.error("Failed to sync user profile:", err.message)
    return { profile: null, access: null, verified: true }
  }
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [profile, setProfile] = useState(null) // Mongo user doc (has .role)
  // Effective role + permissions as computed by the server — used only to
  // decide what to show. Every API route re-checks on its own.
  const [access, setAccess] = useState(null)
  const [loading, setLoading] = useState(true)
  const [emailVerified, setEmailVerified] = useState(false)
  // True once /auth/sync has answered for the current Firebase user and
  // accepted the account. Until then nothing may call protected APIs: the
  // account might be banned, deleted, or not created yet.
  const [sessionReady, setSessionReady] = useState(false)
  // "ACCOUNT_BANNED" after the server refused this account; survives the
  // sign-out so the login / signup page can explain it.
  const [accountBlock, setAccountBlock] = useState(null)

  // The server refused the account itself: never leave the browser signed in
  // to Firebase while the app can't be used — clear everything, sign out.
  const refuse = useCallback((code) => {
    setAccountBlock(code || "ACCOUNT_BANNED")
    setSessionReady(false)
    setFirebaseUser(null)
    setProfile(null)
    setAccess(null)
    setEmailVerified(false)
    setLoading(false)
    if (auth.currentUser) logout().catch((err) => console.error("Sign-out after a refused account failed:", err.message))
  }, [])

  // Any API call can learn the account was banned mid-session.
  useEffect(() => {
    const onBlocked = (e) => refuse(e.detail?.code)
    window.addEventListener(ACCOUNT_BLOCKED_EVENT, onBlocked)
    return () => window.removeEventListener(ACCOUNT_BLOCKED_EVENT, onBlocked)
  }, [refuse])

  // Applies an /auth/sync answer. Returns whether the account is verified.
  const applySync = useCallback(
    ({ profile: synced, access: syncedAccess, verified, blocked }) => {
      if (blocked) {
        refuse(blocked)
        return false
      }
      setAccountBlock(null)
      // An unconfirmed password account never gets a profile or normal access.
      setEmailVerified(verified)
      setProfile(verified ? synced : null)
      setAccess(verified ? syncedAccess : null)
      setSessionReady(true)
      setLoading(false)
      return verified
    },
    [refuse]
  )

  useEffect(() => {
    // Dev StrictMode mounts this effect twice (subscribe → cleanup →
    // subscribe again). If the first subscription's callback is still
    // awaiting the /auth/sync fetch when cleanup runs, it must not be
    // allowed to land afterwards and clobber state set by the second,
    // active subscription — hence the `active` guard before every setState.
    let active = true

    const settle = async (fbUser) => {
      if (!active) return
      setFirebaseUser(fbUser)
      if (!fbUser) {
        setProfile(null)
        setAccess(null)
        setEmailVerified(false)
        setLoading(false)
        return
      }
      const result = await syncProfile(fbUser)
      if (active) applySync(result)
    }

    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (!active) return
      // A second auth transition (e.g. signup right after the initial
      // "not logged in" resolution) must flip `loading` back to true —
      // otherwise consumers see loading:false + a stale/null role for the
      // moment it takes this sync call to return, and make a wrong
      // role-based redirect decision on that stale data.
      setLoading(true)
      setSessionReady(false)
      settle(fbUser)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [applySync])

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) return
    const { user, access: fresh } = await api.get("/auth/me")
    setProfile(user)
    setAccess(fresh)
  }, [])

  // Re-reads the Firebase user (e.g. after the visitor clicks Firebase's
  // verification link in another tab and comes back) and asks the server
  // again. Returns whether the account is verified. Used by the "I have
  // verified, check again" button.
  const recheckEmailVerification = useCallback(async () => {
    if (!auth.currentUser) return false
    await auth.currentUser.reload()
    const fresh = auth.currentUser
    // Force a new ID token so the server sees the updated email_verified claim.
    await fresh.getIdToken(true)
    setFirebaseUser(fresh)
    setLoading(true)
    return applySync(await syncProfile(fresh))
  }, [applySync])

  const can = useCallback((permission) => Boolean(access?.permissions?.includes(permission)), [access])

  const needsEmailVerification = Boolean(firebaseUser) && isPasswordAccount(firebaseUser) && !emailVerified

  const value = useMemo(
    () => ({
      firebaseUser,
      profile,
      // "superadmin" for the protected Super Admin, else the stored role.
      role: access?.role || profile?.role || null,
      isSuperAdmin: Boolean(access?.isSuperAdmin),
      permissions: access?.permissions || [],
      can,
      // Signed in AND accepted by the server — the gate for every protected
      // API call (NotificationBell, ChatWidget, …). Firebase alone is not enough.
      isAuthenticated: Boolean(firebaseUser) && sessionReady,
      needsEmailVerification,
      loading,
      refreshProfile,
      recheckEmailVerification,
      accountBlock,
      clearAccountBlock: () => setAccountBlock(null),
    }),
    [firebaseUser, sessionReady, profile, access, can, loading, needsEmailVerification, refreshProfile, recheckEmailVerification, accountBlock]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
