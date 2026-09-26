"use client"

import { useCallback, useEffect, useState } from "react"

// One poller per key, shared by every component that uses it: a single timer
// and a single request per tick, however many badges show the same number
// (e.g. the header renders its notification bell twice — desktop + mobile).
// Paused while the tab is hidden; refreshed immediately when it's visible
// again, so nothing real-time is lost.
const pollers = new Map()

function getPoller(key) {
  if (!pollers.has(key)) {
    pollers.set(key, { value: undefined, listeners: new Set(), timer: null, inflight: null, fetcher: null, interval: 0 })
  }
  return pollers.get(key)
}

function run(p) {
  if (p.inflight || !p.fetcher) return p.inflight
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return null
  p.inflight = Promise.resolve()
    .then(p.fetcher)
    .then((value) => {
      p.value = value
      p.listeners.forEach((l) => l(value))
    })
    .catch(() => {
      // keep the last value — the badge just won't update this tick
    })
    .finally(() => {
      p.inflight = null
    })
  return p.inflight
}

let visibilityHooked = false
function hookVisibility() {
  if (visibilityHooked || typeof document === "undefined") return
  visibilityHooked = true
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return
    pollers.forEach((p) => p.listeners.size && run(p))
  })
}

export function useSharedPoll(key, fetcher, intervalMs, enabled = true) {
  const [value, setValue] = useState(() => (enabled ? getPoller(key).value : undefined))

  useEffect(() => {
    if (!enabled) {
      setValue(undefined)
      return
    }
    hookVisibility()
    const p = getPoller(key)
    p.fetcher = fetcher
    p.listeners.add(setValue)
    if (p.value !== undefined) setValue(p.value)
    if (!p.timer) {
      p.interval = intervalMs
      run(p)
      p.timer = setInterval(() => run(p), intervalMs)
    }
    return () => {
      p.listeners.delete(setValue)
      if (p.listeners.size === 0) {
        clearInterval(p.timer)
        p.timer = null
      }
    }
    // The fetcher is the same request for a given key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, intervalMs, enabled])

  // Fetch now (deduplicated with any request already in flight).
  const refresh = useCallback(() => run(getPoller(key)), [key])
  // Update locally (e.g. after "mark all read") for every subscriber.
  const set = useCallback(
    (v) => {
      const p = getPoller(key)
      p.value = v
      p.listeners.forEach((l) => l(v))
    },
    [key]
  )
  return { value, refresh, set }
}

// For simple component-owned intervals: skip ticks while the tab is hidden.
export function isTabHidden() {
  return typeof document !== "undefined" && document.visibilityState === "hidden"
}
