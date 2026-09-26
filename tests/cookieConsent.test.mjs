// Cookie consent: storage format, versioning, expiry, category checks, the
// (empty) integration registry and translation coverage. No DB, no network.
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  CATEGORY_KEYS,
  CONSENT_MAX_AGE_DAYS,
  COOKIE_CATEGORIES,
  COOKIE_CONSENT_VERSION,
  DEFAULT_CONSENT,
  PREFERENCE_STORAGE_KEYS,
  STORAGE_INVENTORY,
} from "../lib/cookieConsent/config.js"
import { acceptAllChoice, buildConsent, consentAllows, onlyNecessaryChoice, parseConsent } from "../lib/cookieConsent/consent.js"
import { CONSENT_INTEGRATIONS, allowedIntegrations } from "../lib/cookieConsent/integrations.js"

const NOW = new Date("2026-09-26T12:00:00Z")

test("stored shape: version, four categories, timestamp — nothing else", () => {
  const c = buildConsent({ preferences: true, analytics: "yes", email: "a@b.c" }, NOW)
  assert.deepEqual(Object.keys(c).sort(), ["analytics", "marketing", "necessary", "preferences", "timestamp", "version"])
  assert.deepEqual(c, { version: COOKIE_CONSENT_VERSION, necessary: true, preferences: true, analytics: false, marketing: false, timestamp: NOW.toISOString() })
})

test("accept all / only necessary", () => {
  const all = buildConsent(acceptAllChoice(), NOW)
  for (const k of CATEGORY_KEYS) assert.equal(all[k], true, k)
  const none = buildConsent(onlyNecessaryChoice(), NOW)
  assert.deepEqual({ ...none, timestamp: undefined, version: undefined }, { ...DEFAULT_CONSENT, timestamp: undefined, version: undefined })
  assert.equal(buildConsent({ necessary: false }, NOW).necessary, true, "necessary can't be refused")
})

test("a saved choice is read back; version mismatch, expiry and junk ask again", () => {
  const saved = JSON.stringify(buildConsent({ preferences: true }, NOW))
  assert.equal(parseConsent(saved, NOW).preferences, true)
  assert.equal(parseConsent(JSON.stringify({ ...JSON.parse(saved), version: COOKIE_CONSENT_VERSION + 1 }), NOW), null, "newer policy version")
  assert.equal(parseConsent(JSON.stringify({ ...JSON.parse(saved), version: 0 }), NOW), null, "older policy version")
  const old = new Date(NOW.getTime() - (CONSENT_MAX_AGE_DAYS + 1) * 86400000)
  assert.equal(parseConsent(JSON.stringify(buildConsent({}, old)), NOW), null, "expired")
  const recent = new Date(NOW.getTime() - (CONSENT_MAX_AGE_DAYS - 1) * 86400000)
  assert.ok(parseConsent(JSON.stringify(buildConsent({}, recent)), NOW))
  for (const junk of [null, "", "not json", "[]", "{}", JSON.stringify({ version: 1 }), JSON.stringify({ version: 1, timestamp: "never" })]) {
    assert.equal(parseConsent(junk, NOW), null, String(junk))
  }
  // A tampered value can't grant necessary=false or unknown categories.
  const tampered = parseConsent(JSON.stringify({ version: 1, timestamp: NOW.toISOString(), necessary: false, analytics: "true", spy: true }), NOW)
  assert.deepEqual([tampered.necessary, tampered.analytics, tampered.spy], [true, false, undefined])
})

test("hasCookieConsent logic: necessary always, others only when accepted", () => {
  assert.equal(consentAllows(null, "necessary"), true)
  for (const k of ["preferences", "analytics", "marketing"]) {
    assert.equal(consentAllows(null, k), false, `${k} before any choice`)
    assert.equal(consentAllows(buildConsent(onlyNecessaryChoice(), NOW), k), false, `${k} with only necessary`)
    assert.equal(consentAllows(buildConsent(acceptAllChoice(), NOW), k), true, `${k} with accept all`)
  }
  assert.equal(consentAllows(buildConsent(acceptAllChoice(), NOW), "unknown"), false)
})

test("categories: analytics and marketing exist but are marked not in use", () => {
  assert.deepEqual(CATEGORY_KEYS, ["necessary", "preferences", "analytics", "marketing"])
  const by = Object.fromEntries(COOKIE_CATEGORIES.map((c) => [c.key, c]))
  assert.equal(by.necessary.required, true)
  assert.equal(by.analytics.inUse, false)
  assert.equal(by.marketing.inUse, false)
  assert.deepEqual(PREFERENCE_STORAGE_KEYS, ["provisuell_language", "provisuell_time_format"])
  assert.ok(STORAGE_INVENTORY.every((i) => ["necessary", "preferences"].includes(i.category)), "nothing stored for analytics/marketing")
})

test("no integrations are registered; unsafe entries could never load", () => {
  assert.deepEqual(CONSENT_INTEGRATIONS, [])
  assert.deepEqual(allowedIntegrations(buildConsent(acceptAllChoice(), NOW)), [])
  const list = [
    { id: "a", category: "analytics", src: "https://ok.example/a.js" },
    { id: "b", category: "analytics", src: "http://insecure.example/b.js" },
    { id: "c", category: "analytics", src: "javascript:alert(1)" },
    { id: "d", category: "necessary", src: "https://ok.example/d.js" },
    { id: "e", category: "marketing", src: "https://ok.example/e.js" },
  ]
  assert.deepEqual(allowedIntegrations(buildConsent({ analytics: true }, NOW), list).map((i) => i.id), ["a"])
  assert.deepEqual(allowedIntegrations(buildConsent(onlyNecessaryChoice(), NOW), list), [])
})

test("every language has every cookie text", async () => {
  const LANGS = ["no", "en", "sv", "fi", "da"]
  const needed = [
    "settingsLink", "policyLink", "bannerTitle", "bannerText", "readMore", "acceptAll", "onlyNecessary", "customize",
    "preferencesTitle", "preferencesIntro", "savePreferences", "alwaysActive", "close", "back", "on", "off",
    ...CATEGORY_KEYS.flatMap((k) => [`category.${k}.title`, `category.${k}.description`, `policy.category.${k}`]),
    "category.analytics.notInUse", "category.marketing.notInUse",
    ...STORAGE_INVENTORY.flatMap((i) => [`items.${i.purpose}`, `duration.${i.duration}`, `storage.${i.storage}`]),
    ...["title", "updated", "intro", "statusTitle", "statusText", "whatTitle", "whatText", "whyTitle", "whyText", "categoriesTitle", "detailsTitle", "detailsIntro", "thirdParty", "changeTitle", "changeText", "currentChoice", "noChoiceYet", "durationTitle", "durationText", "contactTitle", "contactText"].map((k) => `policy.${k}`),
    ...["name", "purpose", "category", "provider", "duration"].map((k) => `policy.column.${k}`),
  ]
  const get = (obj, key) => key.split(".").reduce((a, p) => (a && typeof a === "object" ? a[p] : undefined), obj)
  for (const lang of LANGS) {
    const dict = (await import(`../lib/i18n/locales/${lang}.js`))[lang]
    for (const key of needed) assert.equal(typeof get(dict.cookies, key), "string", `${lang}: cookies.${key}`)
  }
  const no = (await import("../lib/i18n/locales/no.js")).no.cookies
  assert.deepEqual([no.settingsLink, no.acceptAll, no.onlyNecessary, no.customize, no.savePreferences], ["Innstillinger for informasjonskapsler", "Godta alle", "Bare nødvendige", "Tilpass", "Lagre valg"])
  assert.deepEqual(CATEGORY_KEYS.map((k) => no.category[k].title), ["Nødvendige", "Preferanser", "Analyse", "Markedsføring"])
})

test("no analytics or marketing code anywhere in the app", () => {
  const roots = ["app", "components", "context", "dashboard", "hooks", "layouts", "lib"]
  const banned = /googletagmanager|gtag\(|google-analytics\.com|\bfbq\(|connect\.facebook\.net|hotjar|clarity\.ms|doubleclick\.net|googleadservices|plausible\.io|segment\.com\/analytics/i
  const hits = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(p)
      else if (/\.(jsx?|mjs|css)$/.test(entry.name) && banned.test(fs.readFileSync(p, "utf8"))) hits.push(p)
    }
  }
  roots.forEach(walk)
  assert.deepEqual(hits, [])
})
