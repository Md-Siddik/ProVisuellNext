"use client"

import { useEffect, useState } from "react"
import { Bell, CalendarClock, FileText, Link2, Mic, Pin, Receipt, ShoppingBag, Trash2, TrendingUp, User, Users, Wallet } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { useTimeFormat } from "@/context/TimeFormatContext"
import { getNorwayNow, osloParts } from "@/lib/appointments/time"
import { fetchNoteFile } from "@/lib/notes/client"

export const RELATED_ICON = {
  order: ShoppingBag,
  appointment: CalendarClock,
  invoice: Receipt,
  expense: Wallet,
  customer: User,
  report: TrendingUp,
}

// "Order: #1045 — ABC AS" (the type is translated, the label is the record's).
export function RelatedChip({ related, className = "" }) {
  const { t } = useTranslation()
  if (!related) return null
  const Icon = RELATED_ICON[related.type] || Link2
  return (
    <span className={`inline-flex max-w-full items-center gap-[5px] rounded-[6px] border border-white/12 bg-white/[0.03] px-[7px] py-[2px] text-[11.5px] text-white/65 ${className}`}>
      <Icon size={12} className="shrink-0 text-white/45" />
      <span className="shrink-0">{t(`notesPage.related_${related.type}`)}</span>
      {related.label && <span className="truncate font-[600] text-white/80">{related.label}</span>}
    </span>
  )
}

export function useReminderSummary() {
  const { t } = useTranslation()
  const { formatInstantDateTime } = useTimeFormat()
  return (reminder) => {
    if (!reminder?.enabled) return ""
    const when = reminder.nextAt ? formatInstantDateTime(reminder.nextAt) : t("notesPage.reminderDone")
    const repeat =
      reminder.recurrence === "custom"
        ? t("notesPage.everyCustom", { n: reminder.customEvery, unit: t(`notesPage.unit_${reminder.customUnit}`) })
        : reminder.recurrence !== "none"
          ? t(`notesPage.repeat_${reminder.recurrence}`)
          : ""
    return [when, repeat, reminder.email ? t("notesPage.byEmail") : ""].filter(Boolean).join(" · ")
  }
}

// "Title" and a one-line preview, Apple Notes style: an untitled note uses
// its first line as the title.
export function noteHeadline(note, t) {
  const lines = String(note.content || "").split("\n").map((l) => l.trim()).filter(Boolean)
  const items = (note.checklistItems || []).map((i) => i.text)
  if (note.title) return { title: note.title, preview: lines.join(" ") || items.join(", ") }
  if (lines.length) return { title: lines[0], preview: lines.slice(1).join(" ") || items.join(", ") }
  if (items.length) return { title: items[0], preview: items.slice(1).join(", ") }
  return { title: t("notesPage.untitled"), preview: "" }
}

// Today → time, otherwise a short date — in Norway time.
export function useShortWhen() {
  const { formatInstantDate, formatInstantTime } = useTimeFormat()
  return (value) => {
    if (!value) return ""
    return osloParts(value).date === getNorwayNow().date ? formatInstantTime(value) : formatInstantDate(value, { day: "numeric", month: "short" })
  }
}

// One row in a notes list: title, date + preview, small indicators.
export function NoteRow({ note, onOpen, selected = false }) {
  const { t } = useTranslation()
  const shortWhen = useShortWhen()
  const { title, preview } = noteHeadline(note, t)
  const shared = note.sharing ? note.sharing.visibility === "shared" : note.sharedWith && note.sharedWith !== "private"
  return (
    <button
      type="button"
      onClick={() => onOpen(note._id)}
      aria-current={selected ? "true" : undefined}
      className={`flex w-full min-w-0 flex-col gap-[3px] rounded-[12px] px-[14px] py-[12px] text-left transition-colors focus-visible:outline-2 focus-visible:outline-[#ff4b00] ${
        selected ? "bg-[#ff4b00]/12" : "hover:bg-white/[0.05]"
      }`}
    >
      <span className="flex min-w-0 items-center gap-[6px]">
        <span className="min-w-0 flex-1 truncate text-[15px] font-[700] text-white">{title}</span>
        {note.isPinned && <Pin size={13} className="shrink-0 text-[#ff4b00]" aria-label={t("notesPage.pinned")} />}
        {note.reminder?.enabled && note.reminder.nextAt && <Bell size={13} className="shrink-0 text-[#ff9b6a]" aria-label={t("notesPage.reminder")} />}
        {shared && <Users size={13} className="shrink-0 text-sky-300" aria-label={t("notesPage.shared")} />}
      </span>
      <span className="flex min-w-0 items-baseline gap-[8px] text-[13px]">
        <span className="shrink-0 text-white/45">{shortWhen(note.updatedAt)}</span>
        <span className="min-w-0 flex-1 truncate text-white/45">{preview || " "}</span>
      </span>
      {(note.related || !note.isOwner) && (
        <span className="flex min-w-0 flex-wrap items-center gap-[6px] pt-[2px]">
          {!note.isOwner && (
            <span className="text-[11.5px] text-sky-300/80">
              {t("notesPage.sharedBy", { name: note.createdByName })}
              {note.createdByRole && <span className="text-sky-300/50"> · {t(`roles.${note.createdByRole}`)}</span>}
              <span className="text-sky-300/50"> · {note.access?.canEdit ? t("notesPage.accessCanEdit") : t("notesPage.accessViewOnly")}</span>
            </span>
          )}
          <RelatedChip related={note.related} />
        </span>
      )}
    </button>
  )
}

export function Attachment({ noteId, file, onRemove }) {
  const { t } = useTranslation()
  const isImage = file.mimeType.startsWith("image/")
  const { url } = useNoteFileUrl(noteId, file._id, isImage)
  const open = async () => {
    // Opened from a blob, so the private file never gets a shareable URL.
    const tab = window.open("", "_blank")
    try {
      const blob = await fetchNoteFile(noteId, file._id)
      const objectUrl = URL.createObjectURL(blob)
      if (tab) tab.location.href = objectUrl
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
    } catch {
      tab?.close()
    }
  }
  return (
    <li className="flex items-center gap-[10px] rounded-[10px] bg-white/[0.04] p-[8px]">
      {isImage && url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-[44px] w-[44px] shrink-0 rounded-[6px] object-cover" />
      ) : (
        <span className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[6px] bg-white/[0.06] text-white/50">
          <FileText size={18} />
        </span>
      )}
      <button type="button" onClick={open} className="min-w-0 flex-1 text-left" aria-label={t("notesPage.openFile", { name: file.fileName })}>
        <span className="block truncate text-[13px] font-[600] text-white/85">{file.fileName}</span>
        <span className="text-[11px] text-white/40">{(file.size / 1024).toFixed(0)} KB</span>
      </button>
      {onRemove && (
        <button type="button" onClick={() => onRemove(file._id)} aria-label={t("notesPage.removeFile")} className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full text-white/45 hover:bg-white/[0.06] hover:text-red-300">
          <Trash2 size={15} />
        </button>
      )}
    </li>
  )
}

export function VoicePlayer({ noteId, voice }) {
  const { t } = useTranslation()
  const { url, error } = useNoteFileUrl(noteId, "voice")
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-[10px]">
      <Mic size={15} className="text-[#ff4b00]" />
      {url ? <audio controls src={url} className="h-[36px] w-full max-w-[360px]" aria-label={t("notesPage.voiceNote")} /> : <span className="text-[12px] text-white/40">{error || t("notesPage.loading")}</span>}
      {voice.durationSec > 0 && <span className="text-[11.5px] text-white/40">{Math.floor(voice.durationSec / 60)}:{String(voice.durationSec % 60).padStart(2, "0")}</span>}
    </div>
  )
}

// Loads a private attachment into a blob URL (revoked when unmounted).
export function useNoteFileUrl(noteId, fileId, enabled = true) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState("")
  useEffect(() => {
    if (!enabled || !noteId || !fileId) return
    let objectUrl
    let cancelled = false
    fetchNoteFile(noteId, fileId)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [noteId, fileId, enabled])
  return { url, error }
}
