// Server-side access to the same NO / EN / SV / FI / DA / RO dictionaries the UI
// uses, for emails. Norwegian is the fallback for any missing key, exactly
// like the client's t().
import { no } from "./locales/no.js"
import { en } from "./locales/en.js"
import { sv } from "./locales/sv.js"
import { fi } from "./locales/fi.js"
import { da } from "./locales/da.js"
import { ro } from "./locales/ro.js"

const DICTS = { no, en, sv, fi, da, ro }
export const LANGUAGES = Object.keys(DICTS)
export const DATE_LOCALES = { no: "no-NO", en: "en-US", sv: "sv-SE", fi: "fi-FI", da: "da-DK", ro: "ro-RO" }

export function isLanguage(value) {
  return LANGUAGES.includes(value)
}

function lookup(dict, key) {
  return key.split(".").reduce((acc, part) => (acc && typeof acc === "object" ? acc[part] : undefined), dict)
}

export function translator(lang) {
  const dict = DICTS[lang] || no
  return (key, vars) => {
    let str = lookup(dict, key)
    if (str === undefined) str = lookup(no, key)
    if (str === undefined) return key
    if (vars) for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, String(v))
    return str
  }
}

// First valid language wins (e.g. the customer's saved one, then the sender's).
export function pickLanguage(...candidates) {
  return candidates.find(isLanguage) || "no"
}
