"use client"

import { useEffect, useState } from "react"
import { ChevronDown } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { useTimeFormat } from "@/context/TimeFormatContext"
import { fetchNoteHistory } from "@/lib/notes/client"
import Sheet from "./Sheet"

function Snapshot({ label, snap }) {
  const { t } = useTranslation()
  const text = [snap?.title, snap?.content].filter(Boolean).join("\n\n")
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-[4px] text-[11px] font-[700] uppercase tracking-[0.08em] text-white/35">{label}</p>
      <p className="max-h-[160px] overflow-y-auto whitespace-pre-wrap break-words rounded-[8px] bg-white/[0.04] px-[10px] py-[8px] text-[13px] leading-[1.5] text-white/75">
        {text || <span className="text-white/30">{t("notesPage.historyEmptyText")}</span>}
      </p>
    </div>
  )
}

// Who changed the note, newest first, each with the text before and after.
// The creator line stays separate: editing never changes who created it.
export default function NoteHistory({ noteId, onClose }) {
  const { t } = useTranslation()
  const { formatInstantDateTime } = useTimeFormat()
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  const [open, setOpen] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchNoteHistory(noteId)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [noteId])

  const when = (at) => formatInstantDateTime(at, { dateStyle: "medium" })

  return (
    <Sheet title={t("notesPage.history")} onClose={onClose}>
      {error && (
        <p role="alert" className="text-[13px] text-red-300">
          {error}
        </p>
      )}
      {!data && !error && <p className="text-[13px] text-white/40">{t("notesPage.loading")}</p>}
      {data && (
        <ol className="flex flex-col gap-[6px]">
          {data.entries.length === 0 && <li className="py-[8px] text-[13.5px] text-white/45">{t("notesPage.historyEmpty")}</li>}
          {data.entries.map((e) => {
            const expanded = open === e._id
            return (
              <li key={e._id} className="rounded-[12px] bg-white/[0.04]">
                <button type="button" onClick={() => setOpen(expanded ? null : e._id)} aria-expanded={expanded} className="flex w-full items-start gap-[10px] px-[12px] py-[10px] text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-[700] text-white">
                      {e.editor.name}
                      {e.editor.role && <span className="font-[500] text-white/45"> · {t(`roles.${e.editor.role}`)}</span>}
                    </span>
                    <span className="block text-[12px] text-white/45">
                      {when(e.editedAt)} · {t("notesPage.historyChanged", { fields: e.fields.map((f) => t(`notesPage.historyField_${f}`)).join(", ") })}
                    </span>
                  </span>
                  <ChevronDown size={16} className={`mt-[3px] shrink-0 text-white/35 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>
                {expanded && (
                  <div className="flex flex-col gap-[8px] px-[12px] pb-[12px] sm:flex-row">
                    <Snapshot label={t("notesPage.historyBefore")} snap={e.previous} />
                    <Snapshot label={t("notesPage.historyAfter")} snap={e.updated} />
                  </div>
                )}
              </li>
            )
          })}
          <li className="px-[12px] py-[8px] text-[12.5px] text-white/40">
            {t("notesPage.historyCreated", { name: data.createdBy.name })}
            {data.createdBy.role && ` · ${t(`roles.${data.createdBy.role}`)}`} · {when(data.createdBy.at)}
          </li>
        </ol>
      )}
    </Sheet>
  )
}
