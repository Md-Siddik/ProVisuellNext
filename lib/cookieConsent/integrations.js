import { OPTIONAL_CATEGORY_KEYS } from "./config.js"
import { consentAllows } from "./consent.js"

// Third-party scripts that may only run with the visitor's consent.
//
// ProVisuell currently loads NO analytics or marketing service, so this list
// is empty on purpose. To add one later (e.g. an analytics tool):
//
//   1. Add an entry below — a fixed, reviewed URL written in code. Never build
//      `src` from user input, the database or a query string.
//        { id: "example-analytics", category: "analytics",
//          src: "https://analytics.example.com/script.js",
//          attributes: { "data-site": "provisuell.no" } }
//   2. Add what it stores to STORAGE_INVENTORY in ./config.js, and describe
//      it in the cookie texts (translations: cookies.*).
//   3. Mark its category `inUse: true` in COOKIE_CATEGORIES.
//   4. Raise COOKIE_CONSENT_VERSION so everyone is asked again.
//
// ConsentScripts (components/cookies/ConsentScripts.jsx) injects each entry
// only after its category is accepted, and never otherwise. Code that has to
// run conditionally (not a <script> tag) should call
// hasCookieConsent("analytics" | "marketing") from ./consent.js first.
export const CONSENT_INTEGRATIONS = []

const HTTPS = /^https:\/\/[^\s"'<>]+$/

// The registered integrations a consent allows. Entries with an unknown
// category or a non-https src are ignored, so a mistake can't load anything.
export function allowedIntegrations(consent, list = CONSENT_INTEGRATIONS) {
  return list.filter((i) => OPTIONAL_CATEGORY_KEYS.includes(i.category) && HTTPS.test(i.src || "") && consentAllows(consent, i.category))
}
