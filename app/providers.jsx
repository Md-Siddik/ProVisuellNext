"use client"

import { I18nProvider } from "@/lib/i18n"
import { AuthProvider } from "@/context/AuthContext"

// Ported from Client/src/App.jsx's <AuthProvider> and Client/src/main.jsx's
// <I18nProvider> — both wrap the whole app, so they live in the root layout
// via this one client boundary (a Server Component root layout can't hold
// hooks/context providers directly).
export default function Providers({ children }) {
  return (
    <I18nProvider>
      <AuthProvider>{children}</AuthProvider>
    </I18nProvider>
  )
}
