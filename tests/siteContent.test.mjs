// Website Editor content resolution (lib/siteContent.js). No DB, no network.
import test from "node:test"
import assert from "node:assert/strict"
import { SHARED_DEFAULTS, isSharedContentKey, parseLegacyCopyright, resolveSiteContent } from "../lib/siteContent.js"

const LANGS = ["no", "en", "sv", "fi", "da", "ro"]
const row = (contentKey, language, value, updatedAt = "2026-09-01T00:00:00Z", type = "text") => ({ contentKey, language, value, type, updatedAt })

test("shared vs translatable keys", () => {
  for (const k of ["footer.copyrightYear", "footer.companyName", "footer.phone", "footer.email", "footer.address", "results.statCustomersValue"]) assert.ok(isSharedContentKey(k), k)
  for (const k of ["hero.title", "footer.rightsReserved", "footer.contactUs", "results.statNationwideValue", "header.login"]) assert.ok(!isSharedContentKey(k), k)
  assert.equal(SHARED_DEFAULTS["footer.companyName"], "ProVisuell AS")
})

test("a shared value saved once shows in every language", () => {
  const docs = [row("footer.copyrightYear", null, "2026"), row("footer.phone", null, "+47 999 99 999")]
  for (const lang of LANGS) {
    const c = resolveSiteContent(docs, lang)
    assert.equal(c["footer.copyrightYear"], "2026", lang)
    assert.equal(c["footer.phone"], "+47 999 99 999", lang)
  }
})

test("translated text stays per language", () => {
  const docs = [row("hero.title", "en", "Hello"), row("hero.title", "no", "Hei")]
  assert.equal(resolveSiteContent(docs, "en")["hero.title"], "Hello")
  assert.equal(resolveSiteContent(docs, "no")["hero.title"], "Hei")
  assert.equal(resolveSiteContent(docs, "sv")["hero.title"], undefined, "falls back to the built-in translation")
})

test("legacy per-language copies of a shared key: newest wins everywhere; a shared row beats them", () => {
  const legacy = [row("footer.phone", "en", "+47 111", "2026-09-10T00:00:00Z"), row("footer.phone", "no", "+47 222", "2026-09-05T00:00:00Z")]
  for (const lang of LANGS) assert.equal(resolveSiteContent(legacy, lang)["footer.phone"], "+47 111", lang)
  const withShared = [...legacy, row("footer.phone", null, "+47 333", "2026-01-01T00:00:00Z")]
  for (const lang of LANGS) assert.equal(resolveSiteContent(withShared, lang)["footer.phone"], "+47 333", lang)
})

test("the old whole-sentence copyright edited in English updates the year for every language", () => {
  // The reported bug: the year was changed to 2026 while English was selected.
  const docs = [row("footer.copyright", "en", "© 2026 ProVisuell AS. All rights reserved.")]
  for (const lang of LANGS) assert.equal(resolveSiteContent(docs, lang)["footer.copyrightYear"], "2026", lang)
  assert.equal(resolveSiteContent(docs, "en")["footer.rightsReserved"], "All rights reserved.")
  assert.equal(resolveSiteContent(docs, "no")["footer.rightsReserved"], undefined, "Norwegian keeps its own translation")
  // A newer shared year row wins over the legacy sentence.
  const newer = [...docs, row("footer.copyrightYear", null, "2027")]
  assert.equal(resolveSiteContent(newer, "no")["footer.copyrightYear"], "2027")
})

test("images and video stay shared", () => {
  const docs = [row("hero.image", null, "/uploads/a.png", undefined, "image")]
  for (const lang of LANGS) assert.equal(resolveSiteContent(docs, lang)["hero.image"], "/uploads/a.png")
})

test("legacy copyright parsing", () => {
  assert.deepEqual(parseLegacyCopyright("© 2026 ProVisuell AS. Alle rettigheter reservert."), { year: "2026", company: "ProVisuell AS", rights: "Alle rettigheter reservert." })
  assert.deepEqual(parseLegacyCopyright("Copyright 2024"), { year: "2024", company: null, rights: null })
  assert.equal(parseLegacyCopyright("no year here"), null)
})
