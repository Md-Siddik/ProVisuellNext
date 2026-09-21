"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "./AuthContext"

// Wrap a route element with this to require login (and optionally a
// specific role). Unauthenticated visitors are bounced to /login with the
// page they wanted stashed (as a ?from= query param — next/navigation has
// no equivalent of react-router's history `state`) so they land back there
// after signing in.
export default function ProtectedRoute({ roles, children }) {
  const { isAuthenticated, role, loading, needsEmailVerification } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const blocked = !isAuthenticated || needsEmailVerification || (roles && !roles.includes(role))

  useEffect(() => {
    if (loading) return
    if (!isAuthenticated) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`)
    } else if (needsEmailVerification) {
      router.replace(`/verify-email?from=${encodeURIComponent(pathname)}`)
    } else if (roles && !roles.includes(role)) {
      // "/" carries no auth/role check of its own, so this can never
      // loop back through another protected redirect.
      router.replace("/")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAuthenticated, needsEmailVerification, role])

  if (loading || blocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[#ff4b00]" />
      </div>
    )
  }

  return children
}
