"use client"

import { useEffect } from "react"
import { allowedIntegrations } from "@/lib/cookieConsent/integrations"

// Loads the registered third-party scripts (lib/cookieConsent/integrations.js)
// whose category the visitor accepted — and nothing else. The registry is
// empty today, so this renders and loads nothing.
//
// Only `src` URLs written in code are used; no inline or user-supplied code
// is ever executed. A script already on the page stays until the next page
// load if consent is withdrawn (browsers can't unload a script).
export default function ConsentScripts({ consent }) {
  useEffect(() => {
    for (const integration of allowedIntegrations(consent)) {
      const id = `consent-script-${integration.id}`
      if (document.getElementById(id)) continue
      const el = document.createElement("script")
      el.id = id
      el.src = integration.src
      el.async = true
      for (const [name, value] of Object.entries(integration.attributes || {})) {
        if (/^data-[a-z0-9-]+$/.test(name)) el.setAttribute(name, String(value))
      }
      document.head.appendChild(el)
    }
  }, [consent])
  return null
}
