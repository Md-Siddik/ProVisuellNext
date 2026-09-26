"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import ProtectedRoute from "@/context/ProtectedRoute"

function DashboardRedirect() {
  const { role, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (role === "owner") router.replace("/dashboard/owner")
    else if (["administrator", "moderator", "superadmin"].includes(role)) router.replace("/dashboard/admin")
    else if (role === "customer") router.replace("/mine-bestillinger")
    // Role not resolved to anything we recognize (sync failed, or a brand
    // new account with a role our checks don't cover) — bail to the
    // marketing site rather than bouncing into another protected redirect.
    else router.replace("/")
  }, [loading, role, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[#ff4b00]" />
    </div>
  )
}

export default function DashboardEntryPage() {
  return (
    <ProtectedRoute>
      <DashboardRedirect />
    </ProtectedRoute>
  )
}
