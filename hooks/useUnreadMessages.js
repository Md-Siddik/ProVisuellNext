"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/context/AuthContext"
import { api } from "@/lib/api"
import { useSharedPoll } from "@/hooks/useSharedPoll"

// How many customer conversations have something new — shared by every
// place that shows a "Meldinger" badge (public header, dashboard sidebar,
// dashboard home). Owner/administrator only; the backend route itself is
// role-gated the same way.
export function useUnreadMessages() {
  const { can, isAuthenticated } = useAuth()
  const canSeeInbox = isAuthenticated && can("messages.view")
  const pathname = usePathname()
  // One shared poll for every badge on screen (layout, dashboard home, chat
  // button) instead of one per component; paused while the tab is hidden.
  const { value, refresh } = useSharedPoll(
    "staff-unread-messages",
    async () => (await api.get("/messages/unread-count")).count,
    20000,
    canSeeInbox
  )

  // Re-check on navigation too — opening a conversation in Meldinger clears
  // its unread flag server-side, and this shows that as soon as the viewer
  // leaves the page (deduplicated: one request, however many badges).
  useEffect(() => {
    if (canSeeInbox) refresh()
  }, [canSeeInbox, pathname, refresh])

  return canSeeInbox ? value || 0 : 0
}
