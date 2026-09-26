import { PREFERENCE_STORAGE_KEYS } from "./config.js"
import { hasCookieConsent } from "./consent.js"

// Storage for "preferences" items (saved language, 12h/24h time format).
//   with preferences consent     localStorage — remembered on the next visit
//   without it                   sessionStorage — this tab, this visit only
// So choosing a language always works; it's only *remembered* with consent.

function store(name) {
  try {
    return typeof window !== "undefined" ? window[name] : null
  } catch {
    return null
  }
}

export function getPreference(key) {
  try {
    // Reading a value saved under an earlier consent is fine: nothing new is
    // stored, and applyPreferenceConsent() removes it if consent is refused.
    return store("localStorage")?.getItem(key) ?? store("sessionStorage")?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function setPreference(key, value) {
  try {
    const persistent = hasCookieConsent("preferences")
    const target = store(persistent ? "localStorage" : "sessionStorage")
    const other = store(persistent ? "sessionStorage" : "localStorage")
    if (value == null) target?.removeItem(key)
    else target?.setItem(key, value)
    other?.removeItem(key)
  } catch {
    // Storage blocked — the choice just isn't remembered.
  }
}

export function removePreference(key) {
  try {
    store("localStorage")?.removeItem(key)
    store("sessionStorage")?.removeItem(key)
  } catch {
    // ignore
  }
}

// Moves preference items to where the new consent allows them: into
// localStorage when granted, out of it (kept for this visit) when refused.
export function applyPreferenceConsent(granted) {
  const local = store("localStorage")
  const session = store("sessionStorage")
  if (!local || !session) return
  for (const key of PREFERENCE_STORAGE_KEYS) {
    try {
      const from = granted ? session : local
      const to = granted ? local : session
      const value = from.getItem(key)
      if (value != null) to.setItem(key, value)
      from.removeItem(key)
    } catch {
      // ignore
    }
  }
}
