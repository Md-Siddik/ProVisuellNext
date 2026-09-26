// Cookie consent — the single place that defines the policy. Everything else
// (banner, preferences panel, cookie policy page, storage helpers, future
// integrations) reads from here. Pure data: safe on server and client.
//
// A future admin screen can manage these values by loading them from the
// database instead of this file; every consumer already goes through the
// exports below.

// Raise this when the cookie policy changes significantly (e.g. the first
// analytics or marketing service is added): every visitor is asked again.
export const COOKIE_CONSENT_VERSION = 1

// Where the visitor's choice is stored (localStorage, this device only).
export const CONSENT_STORAGE_KEY = "provisuell_cookie_consent"

// A saved choice is asked again after this long, even without a version bump.
export const CONSENT_MAX_AGE_DAYS = 365

// Categories, in display order. `required` = always on, can't be switched
// off. `inUse` = whether ProVisuell currently uses anything in the category;
// the UI and the cookie policy say so plainly when it doesn't.
// Texts live in the translations under cookies.category.<key>.
export const COOKIE_CATEGORIES = [
  { key: "necessary", required: true, inUse: true },
  { key: "preferences", required: false, inUse: true },
  { key: "analytics", required: false, inUse: false },
  { key: "marketing", required: false, inUse: false },
]

export const CATEGORY_KEYS = COOKIE_CATEGORIES.map((c) => c.key)
export const OPTIONAL_CATEGORY_KEYS = COOKIE_CATEGORIES.filter((c) => !c.required).map((c) => c.key)

// What a visitor has before choosing, and after "Only necessary".
export const DEFAULT_CONSENT = { necessary: true, preferences: false, analytics: false, marketing: false }

// Everything ProVisuell itself stores in the browser, as listed on the cookie
// policy page. Keep this in step with the code: nothing here is a real
// cookie (document.cookie) — it's all browser storage.
//   name      as it appears in the browser's developer tools
//   storage   localStorage | sessionStorage | indexedDB
//   purpose   translation key under cookies.items.<purpose>
//   duration  translation key under cookies.duration.<duration>
export const STORAGE_INVENTORY = [
  { name: CONSENT_STORAGE_KEY, storage: "localStorage", category: "necessary", provider: "ProVisuell", purpose: "consent", duration: "consent" },
  { name: "firebaseLocalStorageDb", storage: "indexedDB", category: "necessary", provider: "Google Firebase (ProVisuell login)", purpose: "login", duration: "untilLogout" },
  { name: "provisuell_chat_messages", storage: "localStorage", category: "necessary", provider: "ProVisuell", purpose: "chat", duration: "untilCleared" },
  { name: "provisuell_cooldown_*", storage: "localStorage", category: "necessary", provider: "ProVisuell", purpose: "cooldown", duration: "minutes" },
  { name: "pv_blog_intent", storage: "sessionStorage", category: "necessary", provider: "ProVisuell", purpose: "blogIntent", duration: "session" },
  { name: "provisuell_language", storage: "localStorage", category: "preferences", provider: "ProVisuell", purpose: "language", duration: "untilChanged" },
  { name: "provisuell_time_format", storage: "localStorage", category: "preferences", provider: "ProVisuell", purpose: "timeFormat", duration: "untilChanged" },
]

// Browser-storage keys that may only be kept long-term with "preferences"
// consent. Without it they live in sessionStorage (this tab, this visit).
export const PREFERENCE_STORAGE_KEYS = STORAGE_INVENTORY.filter((i) => i.category === "preferences").map((i) => i.name)
