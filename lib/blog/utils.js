export function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
}

const WORDS_PER_MINUTE = 200

export function readingTimeMinutes(plainText) {
  const words = String(plainText || "").trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))
}

export function makeExcerpt(plainText, max = 180) {
  const text = String(plainText || "").trim()
  if (text.length <= max) return text
  return `${text.slice(0, max).replace(/\s+\S*$/, "")}…`
}

export function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function toInt(value, fallback, { min = 1, max = 100 } = {}) {
  const n = parseInt(value, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

// Media must live in our own uploads folder or be an https URL.
export function isSafeMediaUrl(url) {
  if (typeof url !== "string" || !url) return false
  if (/^\/uploads\/[A-Za-z0-9._-]+$/.test(url)) return true
  try {
    return new URL(url).protocol === "https:"
  } catch {
    return false
  }
}

export const idToString = (v) => (v ? String(v) : null)
