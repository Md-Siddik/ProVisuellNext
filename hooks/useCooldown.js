"use client"

import { useCallback, useEffect, useState } from "react"

// A resend cooldown that survives reloads (localStorage, per key), so
// refreshing the page doesn't reset it. Returns seconds left and start().
export function useCooldown(key, seconds = 60) {
  const storageKey = key ? `provisuell_cooldown_${key}` : null
  const read = useCallback(() => {
    if (!storageKey) return 0
    try {
      const until = Number(localStorage.getItem(storageKey) || 0)
      return Math.max(0, Math.ceil((until - Date.now()) / 1000))
    } catch {
      return 0
    }
  }, [storageKey])

  const [left, setLeft] = useState(0)

  useEffect(() => {
    setLeft(read())
    const timer = setInterval(() => setLeft(read()), 1000)
    return () => clearInterval(timer)
  }, [read])

  const start = useCallback(() => {
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, String(Date.now() + seconds * 1000))
    } catch {
      // storage unavailable — the server-side limit still applies
    }
    setLeft(seconds)
  }, [storageKey, seconds])

  return { left, start }
}
