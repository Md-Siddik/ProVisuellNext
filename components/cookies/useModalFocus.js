"use client"

import { useEffect } from "react"

// Modal behaviour shared by the cookie banner and preferences panel: focus
// moves into `ref`, Tab / Shift+Tab stay inside it, the page behind doesn't
// scroll, and focus returns afterwards. `onEscape` (optional) runs on Escape;
// without it Escape does nothing (the banner requires a choice).
export function useModalFocus(ref, { active = true, onEscape, initialFocus } = {}) {
  useEffect(() => {
    if (!active) return
    const before = document.activeElement
    ;(initialFocus?.current || ref.current)?.focus({ preventScroll: true })
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onEscape?.()
        return
      }
      if (e.key !== "Tab" || !ref.current) return
      const items = [...ref.current.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled)
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      const inside = ref.current.contains(document.activeElement)
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    const { overflow } = document.body.style
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = overflow
      if (before && typeof before.focus === "function" && document.contains(before)) before.focus({ preventScroll: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, onEscape])
}
