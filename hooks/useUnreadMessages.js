"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { api } from "@/lib/api"

// How many customer conversations have something new — shared by every
// place that shows a "Meldinger" badge (public header, dashboard sidebar,
// dashboard home). Owner/administrator only; the backend route itself is
// role-gated the same way.
export function useUnreadMessages() {
  const { role, isAuthenticated } = useAuth()
  const canSeeInbox = isAuthenticated && (role === "owner" || role === "administrator")
  const [count, setCount] = useState(0)
  const pathname = usePathname()

  useEffect(() => {
    if (!canSeeInbox) {
      setCount(0)
      return
    }
    let cancelled = false
    const check = async () => {
      try {
        const { count } = await api.get("/messages/unread-count")
        if (!cancelled) setCount(count)
      } catch {
        // ignore — badge just won't update this tick
      }
    }
    check()
    const interval = setInterval(check, 20000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
    // Re-checks on every navigation too (cheap single request) — opening a
    // conversation in Meldinger clears its unread flag server-side, and
    // this makes the badge reflect that the moment the viewer leaves the
    // page instead of waiting up to 20s for the next poll.
  }, [canSeeInbox, pathname])

  return count
}