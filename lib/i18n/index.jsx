"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { no } from "./locales/no"
import { en } from "./locales/en"
import { sv } from "./locales/sv"
import { fi } from "./locales/fi"
import { da } from "./locales/da"
import { ro } from "./locales/ro"
import { api } from "../api"
import { usePathname } from "next/navigation"
import { setActiveLocale } from "./locale"
import { SHARED_DEFAULTS } from "../siteContent"
import { getPreference, removePreference, setPreference } from "../cookieConsent/preferenceStorage"

// Norwegian is the required-complete source of truth (see locales/no.js) —
// every other language falls back to it for any key it hasn't got yet, so
// the UI never shows a raw key or silently falls back to English.
const DICTS = { no, en, sv, fi, da, ro }

export const LANGUAGES = [
  { code: "no", label: "NO", name: "Norsk" },
  { code: "en", label: "EN", name: "English" },
  { code: "sv", label: "SV", name: "Svenska" },
  { code: "fi", label: "FI", name: "Suomi" },
  { code: "da", label: "DA", name: "Dansk" },
  { code: "ro", label: "RO", name: "Română" },
]

const HTML_LANG = { no: "nb", en: "en", sv: "sv", fi: "fi", da: "da", ro: "ro" }
const STORAGE_KEY = "provisuell_language"

function getStoredLanguage() {
  try {
    // A "preferences" item: remembered across visits only with consent.
    const v = getPreference(STORAGE_KEY)
    return DICTS[v] ? v : "no"
  } catch {
    return "no"
  }
}

function lookup(dict, key) {
  return key.split(".").reduce((acc, part) => (acc && typeof acc === "object" ? acc[part] : undefined), dict)
}

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  // Server-rendered HTML always starts as "no" (localStorage isn't available
  // during SSR) — getStoredLanguage() only runs once hydrated, in the lazy
  // useState initializer below, avoiding a hydration mismatch.
  const [language, setLanguageState] = useState("no")
  // Date/time formatters outside React read this — set during render so it is
  // already current when the children below render.
  setActiveLocale(language)
  const [hydrated, setHydrated] = useState(false)
  // CMS overrides from the Website Editor, keyed by contentKey. Translatable
  // text is language-scoped server-side (only the current language's rows
  // come back); shared text (contact details, copyright year — see
  // lib/siteContent.js) and image/video have no language and apply to everyone.
  const [overrides, setOverrides] = useState({})

  useEffect(() => {
    setLanguageState(getStoredLanguage())
    setHydrated(true)
  }, [])

  const refreshContent = useCallback(async () => {
    try {
      const { content } = await api.public.get(`/site-content?lang=${language}`)
      setOverrides(content || {})
    } catch {
      // CMS unreachable — site still works on its static translation defaults
    }
  }, [language])

  useEffect(() => {
    if (hydrated) refreshContent()
  }, [hydrated, refreshContent])

  const setLanguage = useCallback((lang) => {
    if (!DICTS[lang]) return
    setLanguageState(lang)
    // Remembered across visits only with "preferences" cookie consent;
    // otherwise for this visit only (lib/cookieConsent/preferenceStorage.js).
    if (lang === "no") removePreference(STORAGE_KEY)
    else setPreference(STORAGE_KEY, lang)
  }, [])

  const t = useCallback(
    (key, vars) => {
      let str = overrides[key]
      // Shared values have one built-in default for every language.
      if (str === undefined) str = SHARED_DEFAULTS[key]
      if (str === undefined) str = lookup(DICTS[language], key)
      if (str === undefined) str = lookup(no, key)
      if (str === undefined) return key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, v)
      }
      return str
    },
    [language, overrides]
  )

  // Images/video are stored CMS-side with no language, so a single override
  // map entry covers every language — pass the component's own default as
  // fallback for when no admin edit exists yet.
  const getMedia = useCallback((key, fallback) => overrides[key] || fallback, [overrides])

  // The browser tab title and <html lang> follow the selected language too.
  // Re-applied on navigation because Next resets the title from route metadata.
  const pathname = usePathname()
  useEffect(() => {
    if (!hydrated) return
    document.documentElement.lang = HTML_LANG[language] || "nb"
    if (!pathname?.startsWith("/blog")) document.title = t("meta.title")
  }, [hydrated, language, t, pathname])

  const value = useMemo(
    () => ({ language, setLanguage, t, getMedia, refreshContent, hydrated }),
    [language, setLanguage, t, getMedia, refreshContent, hydrated]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useTranslation() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useTranslation must be used within I18nProvider")
  return ctx
}
