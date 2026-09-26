"use client"

import { useEffect, useRef } from "react"
import { X } from "lucide-react"
import { useTranslation } from "@/lib/i18n"

// A bottom sheet on phones, a small centred dialog from `sm` up.
// Escape and a tap outside close it; the page behind doesn't scroll.
export default function Sheet({ title, onClose, children, labelledBy, className = "" }) {
  const { t } = useTranslation()
  const panel = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener("keydown", onKey, true)
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const returnTo = document.activeElement
    panel.current?.focus()
    return () => {
      document.removeEventListener("keydown", onKey, true)
      document.body.style.overflow = previous
      if (returnTo && typeof returnTo.focus === "function") returnTo.focus()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 sm:items-center sm:p-[16px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : title}
        aria-labelledby={labelledBy}
        className={`max-h-[88dvh] w-full overflow-y-auto rounded-t-[18px] border border-white/10 bg-[#161717] pb-[max(16px,env(safe-area-inset-bottom))] outline-none sm:max-w-[420px] sm:rounded-[16px] sm:pb-[16px] ${className}`}
      >
        <div className="sticky top-0 z-[1] flex items-center gap-[8px] bg-[#161717] px-[16px] pb-[8px] pt-[14px]">
          <span className="mx-auto h-[4px] w-[36px] rounded-full bg-white/15 sm:hidden" aria-hidden="true" />
        </div>
        <div className="flex items-center justify-between gap-[10px] px-[16px] pb-[10px]">
          <h2 className="text-[16px] font-[800] text-white">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t("notesPage.close")} className="flex h-[40px] w-[40px] items-center justify-center rounded-full text-white/60 hover:bg-white/[0.06] hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="px-[16px]">{children}</div>
      </div>
    </div>
  )
}
