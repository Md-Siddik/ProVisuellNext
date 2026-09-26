"use client"

import { useEffect, useRef } from "react"
import { isTabHidden } from "./useSharedPoll"

// Re-runs `refetch` when the user comes back to the tab, and every
// `intervalMs` while it stays visible — so something another user did (e.g.
// sharing a note with you) shows up without reloading the page. Skipped
// while `enabled` is false (e.g. the user has paged further down a list).
export function useRefetchOnReturn(refetch, { intervalMs = 60000, enabled = true } = {}) {
  const latest = useRef(refetch)
  latest.current = refetch

  useEffect(() => {
    if (!enabled) return
    const run = () => !isTabHidden() && latest.current()
    const onVisible = () => document.visibilityState === "visible" && run()
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", run)
    const timer = intervalMs ? setInterval(run, intervalMs) : null
    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", run)
      if (timer) clearInterval(timer)
    }
  }, [enabled, intervalMs])
}
