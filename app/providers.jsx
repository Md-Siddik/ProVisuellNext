"use client"

import { I18nProvider } from "@/lib/i18n"
import { AuthProvider } from "@/context/AuthContext"
import { TimeFormatProvider } from "@/context/TimeFormatContext"
import { NotesProvider } from "@/context/NotesContext"
import { CookieConsentProvider } from "@/context/CookieConsentContext"

// Ported from Client/src/App.jsx's <AuthProvider> and Client/src/main.jsx's
// <I18nProvider> — both wrap the whole app, so they live in the root layout
// via this one client boundary (a Server Component root layout can't hold
// hooks/context providers directly).
export default function Providers({ children }) {
  return (
    <I18nProvider>
      {/* Cookie choice: banner, preferences panel and consent-gated scripts.
          Login is necessary and never depends on it. */}
      <CookieConsentProvider>
      <AuthProvider>
        {/* Needs the signed-in profile to load/save the 12h/24h preference. */}
        <TimeFormatProvider>
          {/* Internal notes: available on every staff page (renders nothing for others). */}
          <NotesProvider>{children}</NotesProvider>
        </TimeFormatProvider>
      </AuthProvider>
      </CookieConsentProvider>
    </I18nProvider>
  )
}
