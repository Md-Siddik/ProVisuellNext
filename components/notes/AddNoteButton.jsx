"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { StickyNote } from "lucide-react"
import { api } from "@/lib/api"
import { useAuth } from "@/context/AuthContext"
import { useNotes } from "@/context/NotesContext"
import { useTranslation } from "@/lib/i18n"
import { NOTES_CHANGED_EVENT } from "@/lib/notes/client"

// Contextual "Add note" for a record (order, appointment, invoice, expense,
// customer, report month). Renders nothing for users without Notes access.
// A plain button — works the same with mouse, keyboard and touch; it never
// takes over the record's own click behaviour (the click stops here).
//
//   variant="button" (detail views): "Add note" + "Notes (n)" link
//   variant="icon"   (table rows):   compact icon with the note count
export default function AddNoteButton({ type, id, variant = "button", className = "" }) {
  const { t } = useTranslation()
  const { role } = useAuth()
  const { enabled, openNewNote } = useNotes()
  const [count, setCount] = useState(null)
  const base = role === "owner" ? "/dashboard/owner" : "/dashboard/admin"

  useEffect(() => {
    if (!enabled || !id) return
    let cancelled = false
    const load = () =>
      api
        .get(`/notes?countOnly=1&filter=all&relatedType=${type}&relatedId=${encodeURIComponent(id)}`)
        .then((d) => !cancelled && setCount(d.total))
        .catch(() => {})
    load()
    const onChange = (e) => {
      const r = e.detail?.related
      if (!r || (r.type === type && String(r.id) === String(id))) load()
    }
    window.addEventListener(NOTES_CHANGED_EVENT, onChange)
    return () => {
      cancelled = true
      window.removeEventListener(NOTES_CHANGED_EVENT, onChange)
    }
  }, [enabled, type, id])

  if (!enabled || !id) return null
  const open = (e) => {
    e.stopPropagation()
    e.preventDefault()
    openNewNote({ type, id })
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={open}
        aria-label={count ? t("notesPage.addNoteWithCount", { n: count }) : t("notesPage.addNote")}
        title={t("notesPage.addNote")}
        className={`relative inline-flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[8px] border border-white/12 text-white/55 transition-colors hover:border-[#ff4b00]/50 hover:text-[#ff4b00] focus-visible:outline-2 focus-visible:outline-[#ff4b00] ${className}`}
      >
        <StickyNote size={15} />
        {count > 0 && (
          <span className="absolute -right-[5px] -top-[5px] flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#ff4b00] px-[4px] text-[9.5px] font-[800] text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
    )
  }

  return (
    <div className={`flex flex-wrap items-center gap-[8px] ${className}`}>
      <button
        type="button"
        onClick={open}
        className="inline-flex items-center gap-[7px] rounded-[10px] border border-white/15 px-[12px] py-[8px] text-[12.5px] font-[700] text-white/80 transition-colors hover:border-[#ff4b00]/50 hover:text-white"
      >
        <StickyNote size={14} className="text-[#ff4b00]" />
        {t("notesPage.addNote")}
      </button>
      {count > 0 && (
        <Link
          href={`${base}/notater?relatedType=${type}&relatedId=${encodeURIComponent(id)}`}
          onClick={(e) => e.stopPropagation()}
          className="text-[12px] font-[600] text-white/50 underline-offset-2 hover:text-white hover:underline"
        >
          {t("notesPage.viewNotes", { n: count })}
        </Link>
      )}
    </div>
  )
}
