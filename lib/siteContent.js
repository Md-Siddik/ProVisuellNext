// Website Editor content: which keys are shared by every language, and how
// stored rows become the content map one language sees. Pure — used by the
// API, the browser (i18n + editor) and the tests.
//
// Storage (SiteContent collection): one row per (contentKey, language).
//   • translatable text   one row per language ("no", "en", …)
//   • shared text         ONE row with language: null — every language reads it
//   • images / video      ONE row with language: null (as before)
//
// Rows written per language for a shared key before this existed are still
// honoured (the newest one wins for every language) until the key is saved
// again or scripts/migrateSiteContent.mjs folds them into the shared row.

// Values that are the same in every language: contact details, company
// name, copyright year, plain numbers. Anything a translator would touch
// (headings, labels, sentences) is NOT here and stays per language.
export const SHARED_DEFAULTS = {
  "footer.companyName": "ProVisuell AS",
  "footer.copyrightYear": "2025",
  "footer.address": "Stortelia 7, 0250 Oslo",
  "footer.email": "post@provisuell.no",
  "footer.phone": "+47 123 45 678",
  "results.statCustomersValue": "350+",
  "results.statProjectsValue": "1200+",
  "results.statExperienceValue": "10+",
}

export const SHARED_TEXT_KEYS = Object.keys(SHARED_DEFAULTS)

export function isSharedContentKey(key) {
  return SHARED_TEXT_KEYS.includes(key)
}

// Before the copyright line was split into year / company / "All rights
// reserved", the whole sentence was one translatable key.
export const LEGACY_COPYRIGHT_KEY = "footer.copyright"

// "© 2026 ProVisuell AS. All rights reserved." → { year, company, rights }
export function parseLegacyCopyright(value) {
  const text = String(value ?? "").trim()
  const full = text.match(/^(?:©|\(c\))?\s*((?:19|20)\d{2})\s+(.+?)\.\s+(.+?)\s*$/i)
  if (full) return { year: full[1], company: full[2].trim(), rights: full[3].trim() }
  const year = text.match(/\b((?:19|20)\d{2})\b/)
  return year ? { year: year[1], company: null, rights: null } : null
}

// Rows a content request needs: the language's own rows, every shared row,
// and legacy per-language rows of shared keys (any language).
export function siteContentQuery(lang) {
  return { $or: [{ language: lang }, { language: null }, { contentKey: { $in: [...SHARED_TEXT_KEYS, LEGACY_COPYRIGHT_KEY] } }] }
}

const time = (doc) => new Date(doc.updatedAt || doc.createdAt || 0).getTime()

// Stored rows → { contentKey: value } for `lang`.
export function resolveSiteContent(docs, lang) {
  const content = {}
  const sharedGlobal = new Set()
  const sharedLegacy = new Map() // key -> newest per-language row
  let legacyCopyrightNewest = null
  let legacyCopyrightOwn = null

  for (const doc of docs || []) {
    const key = doc.contentKey
    if (key === LEGACY_COPYRIGHT_KEY) {
      if (!doc.language) continue
      if (!legacyCopyrightNewest || time(doc) > time(legacyCopyrightNewest)) legacyCopyrightNewest = doc
      if (doc.language === lang) legacyCopyrightOwn = doc
      continue
    }
    if (doc.language == null) {
      content[key] = doc.value
      if (isSharedContentKey(key)) sharedGlobal.add(key)
      continue
    }
    if (isSharedContentKey(key)) {
      const prev = sharedLegacy.get(key)
      if (!prev || time(doc) > time(prev)) sharedLegacy.set(key, doc)
      continue
    }
    if (doc.language === lang) content[key] = doc.value
  }

  // Shared keys never saved as a shared row yet: the newest edit made in any
  // language applies to all of them.
  for (const [key, doc] of sharedLegacy) if (!sharedGlobal.has(key)) content[key] = doc.value

  // Legacy whole-sentence copyright rows.
  const newest = parseLegacyCopyright(legacyCopyrightNewest?.value)
  if (newest) {
    if (content["footer.copyrightYear"] === undefined) content["footer.copyrightYear"] = newest.year
    if (content["footer.companyName"] === undefined && newest.company) content["footer.companyName"] = newest.company
  }
  const own = parseLegacyCopyright(legacyCopyrightOwn?.value)
  if (own?.rights && content["footer.rightsReserved"] === undefined) content["footer.rightsReserved"] = own.rights
  return content
}
