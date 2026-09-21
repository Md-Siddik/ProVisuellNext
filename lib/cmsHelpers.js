import { ApiError } from "./auth.js"

export const ALLOWED_COLLECTIONS = ["services", "portfolioItems", "featuredProjects", "headerNav", "heroServices", "socialLinks"]

export function assertValidCollection(collection) {
  if (!ALLOWED_COLLECTIONS.includes(collection)) {
    throw new ApiError(404, "Unknown collection")
  }
}

export function resolveTranslations(translations, lang) {
  const out = {}
  const entries = translations instanceof Map ? translations.entries() : Object.entries(translations || {})
  for (const [field, values] of entries) {
    out[field] = values?.[lang] || values?.no || Object.values(values || {}).find(Boolean) || ""
  }
  return out
}
