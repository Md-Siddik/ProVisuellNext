"use client"

import { Eye, Lock, PencilLine, Users } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { useTimeFormat } from "@/context/TimeFormatContext"
import { SHARE_ROLES } from "@/lib/notes/core"

// Small shared pieces for showing a note's sharing and who touched it.
// Everything here only displays what the server sent (note.sharing,
// note.access, note.lastEdited); the server decides all of it.

const ROLE_ORDER = SHARE_ROLES

export function isShared(note) {
  return note?.sharing?.visibility === "shared"
}

// "Private" | "Administrators, Owners + 2 people"
export function useShareSummary() {
  const { t } = useTranslation()
  return (sharing) => {
    if (sharing?.visibility !== "shared") return t("notesPage.share_private")
    const parts = ROLE_ORDER.filter((r) => sharing.roles.includes(r)).map((r) => t(`notesPage.shareRole_${r}`))
    const people = sharing.users?.length || 0
    if (people) parts.push(people === 1 ? t("notesPage.sharePeopleOne") : t("notesPage.sharePeopleMany", { n: people }))
    return parts.join(", ") || t("notesPage.shared")
  }
}

export function ShareIcon({ sharing, size = 18, className = "" }) {
  const Icon = sharing?.visibility === "shared" ? Users : Lock
  return <Icon size={size} className={className} />
}

// "Shared with you · View only" / "· Can edit"
export function AccessBadge({ note, className = "" }) {
  const { t } = useTranslation()
  if (!note || note.isOwner) return null
  const edit = note.access?.canEdit
  const Icon = edit ? PencilLine : Eye
  return (
    <span className={`inline-flex items-center gap-[5px] rounded-full border border-sky-400/30 bg-sky-400/10 px-[8px] py-[2px] text-[11.5px] font-[700] text-sky-200 ${className}`}>
      <Users size={11} /> {t("notesPage.sharedWithYou")}
      <span className="text-sky-200/50">·</span>
      <Icon size={11} /> {edit ? t("notesPage.accessCanEdit") : t("notesPage.accessViewOnly")}
    </span>
  )
}

function roleLabel(t, role) {
  return role ? t(`roles.${role}`) : ""
}

// Creator and last editor, kept apart:
//   Created by Kari Nordmann · Owner
//   Last edited by John Doe · Administrator · 26 Sep 2026, 14:30
export function NoteAuthorship({ note, className = "" }) {
  const { t } = useTranslation()
  const { formatInstantDateTime } = useTimeFormat()
  if (!note?._id) return null
  const last = note.lastEdited
  const creator = note.isOwner ? t("notesPage.you") : note.createdByName
  return (
    <div className={`flex flex-col gap-[2px] text-[12px] text-white/45 ${className}`}>
      <span>
        {t("notesPage.createdByLine", { name: creator })}
        {!note.isOwner && note.createdByRole && <span className="text-white/35"> · {roleLabel(t, note.createdByRole)}</span>}
      </span>
      {last && (
        <span>
          {last.byMe ? t("notesPage.lastEditedByYou") : t("notesPage.lastEditedByLine", { name: last.name })}
          {!last.byMe && last.role && <span className="text-white/35"> · {roleLabel(t, last.role)}</span>}
          <span className="text-white/35"> · {formatInstantDateTime(last.at, { dateStyle: "medium" })}</span>
        </span>
      )}
    </div>
  )
}
