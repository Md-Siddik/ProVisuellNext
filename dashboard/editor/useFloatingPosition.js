"use client"

import { useEffect, useState } from "react"

const MARGIN = 8
const CARET_SIZE = 8

// Shared positioning math for every floating editor popover (text edits,
// item toolbars, the add/edit form) — computed from the trigger element's
// own bounding rect so the popover always opens as a dropdown directly
// beside/below the exact element that was clicked, never centered on the
// page. Flips above when there's no room below, and shifts left when
// there's no room on the right. Also returns where to draw a small caret
// (the "angle" pointer) so the popover visually connects back to the
// clicked icon, like a standard dropdown menu.
export function useFloatingPosition(anchorRef, active, { width = 320, height = 200 } = {}) {
  const [pos, setPos] = useState(null)

  useEffect(() => {
    if (!active) {
      setPos(null)
      return
    }

    const compute = () => {
      if (!anchorRef.current) return
      const rect = anchorRef.current.getBoundingClientRect()
      const anchorCenterX = rect.left + rect.width / 2

      let top = rect.bottom + MARGIN + CARET_SIZE / 2
      let placement = "below"
      if (top + height > window.innerHeight - MARGIN) {
        const above = rect.top - height - MARGIN - CARET_SIZE / 2
        if (above >= MARGIN) {
          top = above
          placement = "above"
        } else {
          // Neither full placement fits (short viewport / huge popover) —
          // clamp on-screen rather than letting it run off either edge.
          top = Math.max(MARGIN, Math.min(top, window.innerHeight - height - MARGIN))
        }
      }

      // Dropdown-style: try to center the popover under the icon rather
      // than always hugging its left edge, so it reads as "opening from"
      // the icon instead of drifting off to one side.
      let left = anchorCenterX - width / 2
      if (left + width > window.innerWidth - MARGIN) left = window.innerWidth - width - MARGIN
      if (left < MARGIN) left = MARGIN

      // Caret position relative to the popover's own left edge, clamped so
      // it always stays over the popover box even when the popover itself
      // got shifted to stay on-screen.
      let caretLeft = anchorCenterX - left
      caretLeft = Math.max(16, Math.min(width - 16, caretLeft))

      setPos({ top, left, placement, caretLeft })
    }

    compute()
    window.addEventListener("scroll", compute, true)
    window.addEventListener("resize", compute)
    return () => {
      window.removeEventListener("scroll", compute, true)
      window.removeEventListener("resize", compute)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, width, height])

  return pos
}