"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Pin } from "lucide-react"
import { api } from "@/lib/api"
import { useAuth } from "@/context/AuthContext"
import { useNotes } from "@/context/NotesContext"
import { useTranslation } from "@/lib/i18n"
import { NOTES_CHANGED_EVENT } from "@/lib/notes/client"
import { NoteRow } from "./noteUi"

// Dashboard home: up to three pinned notes. Shows nothing when there are
// none (or for anyone without Notes access), so it never crowds the page.
export default function PinnedNotesCard() {
  const { t } = useTranslation()
  const { role } = useAuth()
  const { canView: enabled, openNote } = useNotes()
  const [notes, setNotes] = useState([])
  const base = role === "owner" ? "/dashboard/owner" : "/dashboard/admin"

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const load = () =>
      api
        .get("/notes?kind=note&filter=pinned&limit=3")
        .then((d) => !cancelled && setNotes(d.notes))
        .catch(() => {})
    load()
    window.addEventListener(NOTES_CHANGED_EVENT, load)
    return () => {
      cancelled = true
      window.removeEventListener(NOTES_CHANGED_EVENT, load)
    }
  }, [enabled])

  if (!enabled || notes.length === 0) return null
  return (
    <section className="mt-[22px] rounded-[14px] border border-white/[0.08] bg-[#111212] p-[16px]" aria-label={t("notesPage.pinned")}>
      <div className="mb-[10px] flex items-center justify-between gap-[10px]">
        <p className="flex items-center gap-[6px] text-[13px] font-[800] text-white">
          <Pin size={14} className="text-[#ff4b00]" /> {t("notesPage.pinnedNotes")}
        </p>
        <Link href={`${base}/notater`} className="text-[12px] font-[700] text-[#ff4b00] hover:underline">
          {t("notesPage.viewAll")}
        </Link>
      </div>
      <ul className="grid gap-[4px] md:grid-cols-3">
        {notes.map((n) => (
          <li key={n._id} className="min-w-0 rounded-[12px] bg-white/[0.03]">
            <NoteRow note={n} onOpen={openNote} />
          </li>
        ))}
      </ul>
    </section>
  )
}
