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

      const verified = !isPasswordAccount(fbUser) || fbUser.emailVerified
      setEmailVerified(verified)
      if (!verified) {
        // Password account pending email confirmation — never create/sync
        // the application profile, and never grant normal access.
        setProfile(null)
        setLoading(false)
        return
      }

      try {
        const { user } = await api.post("/auth/sync", {
          name: fbUser.displayName || "",
          phone: fbUser.phoneNumber || "",
        })
        if (active) setProfile(user)
      } catch (err) {
        console.error("Failed to sync user profile:", err.message)
        if (active) setProfile(null)
      }
      if (active) setLoading(false)
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

  // Re-reads the Firebase user (e.g. after the visitor clicks the email
  // verification link in another tab and comes back) and, once verified,
  // syncs the application profile. Returns whether the account is verified.
  // Used by the "I have verified, check again" button.
  const recheckEmailVerification = useCallback(async () => {
    if (!auth.currentUser) return false
    await auth.currentUser.reload()
    const fresh = auth.currentUser
    const verified = !isPasswordAccount(fresh) || fresh.emailVerified
    setFirebaseUser(fresh)
    setEmailVerified(verified)
    if (verified) {
      setLoading(true)
      try {
        const { user } = await api.post("/auth/sync", {
          name: fresh.displayName || "",
          phone: fresh.phoneNumber || "",
        })
        setProfile(user)
      } catch (err) {
        console.error("Failed to sync user profile:", err.message)
      }
      setLoading(false)
    }
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
