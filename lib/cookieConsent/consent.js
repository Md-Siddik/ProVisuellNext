import { CATEGORY_KEYS, CONSENT_MAX_AGE_DAYS, CONSENT_STORAGE_KEY, COOKIE_CONSENT_VERSION, DEFAULT_CONSENT, OPTIONAL_CATEGORY_KEYS } from "./config.js"

// Reading, validating and saving the visitor's cookie choice, and asking
// "may I?" for a category. The pure functions take their inputs explicitly
// (tests use them directly); the browser ones never run on the server —
// they check for `window` and swallow storage errors (private mode, quota).
//
// Stored value (localStorage, key CONSENT_STORAGE_KEY) — no personal data:
//   { "version": 1, "necessary": true, "preferences": false,
//     "analytics": false, "marketing": false, "timestamp": "2026-09-26T…Z" }

export const CONSENT_CHANGED_EVENT = "provisuell:cookie-consent-changed"
const DAY_MS = 86400000

// A stored value → the consent it represents, or null when it must be asked
// again (missing, malformed, from another policy version, or too old).
export function parseConsent(raw, now = new Date()) {
  let value = raw
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  if (value.version !== COOKIE_CONSENT_VERSION) return null
  const at = new Date(value.timestamp)
  if (Number.isNaN(at.getTime()) || at > new Date(now.getTime() + DAY_MS)) return null
  if (now - at > CONSENT_MAX_AGE_DAYS * DAY_MS) return null
  const consent = { version: COOKIE_CONSENT_VERSION, necessary: true, timestamp: at.toISOString() }
  for (const key of OPTIONAL_CATEGORY_KEYS) consent[key] = value[key] === true
  return consent
}

// A choice ({ preferences: true, … }) → the value to store. Only known
// categories, only real booleans; necessary is always true.
export function buildConsent(choice = {}, now = new Date()) {
  const consent = { version: COOKIE_CONSENT_VERSION, ...DEFAULT_CONSENT, timestamp: now.toISOString() }
  for (const key of OPTIONAL_CATEGORY_KEYS) consent[key] = choice[key] === true
  consent.necessary = true
  return consent
}

export const acceptAllChoice = () => Object.fromEntries(CATEGORY_KEYS.map((k) => [k, true]))
export const onlyNecessaryChoice = () => ({ ...DEFAULT_CONSENT })

// Whether a (parsed) consent allows a category. Necessary always; anything
// else only when the visitor said yes. Unknown categories: never.
export function consentAllows(consent, category) {
  if (category === "necessary") return true
  if (!OPTIONAL_CATEGORY_KEYS.includes(category)) return false
  return consent?.[category] === true
}

// ---------------------------------------------------------------------------
// Browser
// ---------------------------------------------------------------------------
const inBrowser = () => typeof window !== "undefined"

export function readConsent() {
  if (!inBrowser()) return null
  try {
    return parseConsent(window.localStorage.getItem(CONSENT_STORAGE_KEY))
  } catch {
    return null
  }
}

// Saves a choice and tells the rest of the page (CONSENT_CHANGED_EVENT, with
// { consent, previous } as detail). Returns the stored consent.
export function saveConsent(choice) {
  const consent = buildConsent(choice)
  if (!inBrowser()) return consent
  const previous = readConsent()
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent))
  } catch {
    // Storage blocked: the choice still applies for this page view.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: { consent, previous } }))
  return consent
}

// hasCookieConsent("analytics") — the check every future integration must
// pass before it loads (see lib/cookieConsent/integrations.js).
export function hasCookieConsent(category) {
  return consentAllows(readConsent(), category)
}

export function onConsentChange(listener) {
  if (!inBrowser()) return () => {}
  const handler = (e) => listener(e.detail?.consent || null, e.detail?.previous || null)
  window.addEventListener(CONSENT_CHANGED_EVENT, handler)
  return () => window.removeEventListener(CONSENT_CHANGED_EVENT, handler)
}
