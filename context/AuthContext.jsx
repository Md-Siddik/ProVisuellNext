"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "@/lib/firebaseClient"
import { api } from "@/lib/api"

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
    const { user } = await api.post("/auth/sync", {
      name: fbUser.displayName || "",
      phone: fbUser.phoneNumber || "",
    })
    return { profile: user, verified: true }
  } catch (err) {
    if (err.rawMessage === "Email not verified") return { profile: null, verified: false }
    console.error("Failed to sync user profile:", err.message)
    return { profile: null, verified: !isPasswordAccount(fbUser) || fbUser.emailVerified }
  }
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [profile, setProfile] = useState(null) // Mongo user doc (has .role)
  const [loading, setLoading] = useState(true)
  const [emailVerified, setEmailVerified] = useState(false)

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
        setEmailVerified(false)
        setLoading(false)
        return
      }

      const { profile: synced, verified } = await syncProfile(fbUser)
      if (!active) return
      // An unconfirmed password account never gets a profile or normal access.
      setEmailVerified(verified)
      setProfile(verified ? synced : null)
      setLoading(false)
    }

    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      if (!active) return
      // A second auth transition (e.g. signup right after the initial
      // "not logged in" resolution) must flip `loading` back to true —
      // otherwise consumers see loading:false + a stale/null role for the
      // moment it takes this sync call to return, and make a wrong
      // role-based redirect decision on that stale data.
      setLoading(true)
      settle(fbUser)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) return
    const { user } = await api.get("/auth/me")
    setProfile(user)
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
    const { profile: synced, verified } = await syncProfile(fresh)
    setEmailVerified(verified)
    setProfile(verified ? synced : null)
    setLoading(false)
    return verified
  }, [])

  const needsEmailVerification = Boolean(firebaseUser) && isPasswordAccount(firebaseUser) && !emailVerified

  const value = useMemo(
    () => ({
      firebaseUser,
      profile,
      role: profile?.role || null,
      isAuthenticated: Boolean(firebaseUser),
      needsEmailVerification,
      loading,
      refreshProfile,
      recheckEmailVerification,
    }),
    [firebaseUser, profile, loading, needsEmailVerification, refreshProfile, recheckEmailVerification]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
