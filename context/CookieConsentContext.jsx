"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { acceptAllChoice, consentAllows, onConsentChange, onlyNecessaryChoice, readConsent, saveConsent } from "@/lib/cookieConsent/consent"
import { applyPreferenceConsent } from "@/lib/cookieConsent/preferenceStorage"
import CookieBanner from "@/components/cookies/CookieBanner"
import CookiePreferences from "@/components/cookies/CookiePreferences"
import ConsentScripts from "@/components/cookies/ConsentScripts"

// Owns the visitor's cookie choice for the whole app: shows the banner to
// anyone without a valid saved choice (first visit, new policy version,
// expired), the preferences panel on request (footer "Cookie settings"), and
// keeps preference storage and consent-gated scripts in step with it.
//
// Nothing here touches browser storage during server rendering: state starts
// empty and is read once mounted, so server and client HTML always match.
const CookieConsentContext = createContext({
  consent: null,
  ready: false,
  hasConsent: () => false,
  openSettings: () => {},
})

export function CookieConsentProvider({ children }) {
  const [consent, setConsent] = useState(null)
  const [ready, setReady] = useState(false)
  // null | "banner" | "settings"
  const [view, setView] = useState(null)
  // Where "settings" was opened from: closing it returns to the banner when
  // no choice has been made yet.
  const [fromBanner, setFromBanner] = useState(false)

  useEffect(() => {
    const saved = readConsent()
    setConsent(saved)
    setReady(true)
    // Preference items remembered earlier without (current) consent are kept
    // for this visit only.
    if (!saved?.preferences) applyPreferenceConsent(false)
    if (!saved) setView("banner")
    return onConsentChange((next) => {
      setConsent(next)
      applyPreferenceConsent(Boolean(next?.preferences))
    })
  }, [])

  const choose = useCallback((choice) => {
    saveConsent(choice)
    setView(null)
    setFromBanner(false)
  }, [])

  const openSettings = useCallback(() => {
    setFromBanner(false)
    setView("settings")
  }, [])

  const closeSettings = useCallback(() => {
    setView(!readConsent() ? "banner" : null)
    setFromBanner(false)
  }, [])

  const value = useMemo(
    () => ({ consent, ready, hasConsent: (category) => consentAllows(consent, category), openSettings }),
    [consent, ready, openSettings]
  )

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
      {ready && view === "banner" && (
        <CookieBanner
          onAcceptAll={() => choose(acceptAllChoice())}
          onOnlyNecessary={() => choose(onlyNecessaryChoice())}
          onCustomize={() => {
            setFromBanner(true)
            setView("settings")
          }}
        />
      )}
      {ready && view === "settings" && (
        <CookiePreferences
          consent={consent}
          fromBanner={fromBanner}
          onSave={choose}
          onAcceptAll={() => choose(acceptAllChoice())}
          onOnlyNecessary={() => choose(onlyNecessaryChoice())}
          onClose={closeSettings}
        />
      )}
      {ready && <ConsentScripts consent={consent} />}
    </CookieConsentContext.Provider>
  )
}

export function useCookieConsent() {
  return useContext(CookieConsentContext)
}
