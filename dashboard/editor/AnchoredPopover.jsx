"use client"

import { createPortal } from "react-dom"
import { useFloatingPosition } from "./useFloatingPosition"

// The single mechanism every Website Editor popup uses — text edits, an
// item's Edit/Move/Hide/Delete toolbar, and the add/edit form. Portals to
// document.body and positions itself from the trigger element's own
// bounding rect, dropdown-style, with a small caret pointing back at
// whatever was clicked — so it always opens right there instead of
// drifting to the center of the page or somewhere the admin has to scroll
// to find.
export default function AnchoredPopover({ anchorRef, open, onClose, width = 320, height = 200, className = "", children }) {
  const pos = useFloatingPosition(anchorRef, open, { width, height })

  if (!open || !pos) return null

  return createPortal(
    <div className="pv-popover-backdrop" onClick={onClose}>
      <div
        className={`pv-popover pv-popover-${pos.placement}`}
        style={{ top: pos.top, left: pos.left, width }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="pv-popover-caret" style={{ left: pos.caretLeft }} />
        {/* The caret lives outside this so a scrollable form (className
            adds max-height + overflow-y) never clips it off. */}
        <div className={className}>{children}</div>
      </div>
    </div>,
    document.body
  )
}