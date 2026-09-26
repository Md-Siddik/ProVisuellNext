"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  Archive,
  ArchiveRestore,
  Bell,
  CheckCircle2,
  ChevronLeft,
  Circle,
  ExternalLink,
  History,
  MoreHorizontal,
  Pin,
  PinOff,
  SlidersHorizontal,
  Trash2,
} from "lucide-react"
import { api } from "@/lib/api"
import { useAuth } from "@/context/AuthContext"
import { useTimeFormat } from "@/context/TimeFormatContext"
import { useTranslation } from "@/lib/i18n"
import { getNorwayNow, addDays, osloParts } from "@/lib/appointments/time"
import { LIMITS, relatedHref } from "@/lib/notes/core"
import { announceNotesChanged, saveNote, uploadNoteFile } from "@/lib/notes/client"
import { Attachment, RelatedChip, VoicePlayer } from "./noteUi"
import ReminderPicker, { useRecipientLine } from "./ReminderPicker"
import SharePicker from "./SharePicker"
import NoteHistory from "./NoteHistory"
import { AccessBadge, NoteAuthorship, ShareIcon, useShareSummary } from "./sharing"
import Sheet from "./Sheet"
import AttachmentBar, { MAX_MB } from "./AttachmentBar"

const iconBtn =
  "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/[0.07] disabled:opacity-35 disabled:hover:bg-transparent"
const plain = "text-white/70 hover:text-white"

// The whole note: title + text, saved automatically while typing. Reminder,
// sharing and everything else live behind small buttons in the top bar.
//   noteId   — open an existing note (null = a new one)
//   related  — { type, id } links a new note to the record it came from
export default function NoteEditor({ noteId = null, related = null, onBack, onChange, onDeleted, autoFocus = false }) {
  const { t } = useTranslation()
  const { role, can } = useAuth()
  const { formatInstantDateTime } = useTimeFormat()
  const shareSummary = useShareSummary()
  const base = role === "owner" ? "/dashboard/owner" : "/dashboard/admin"

  const [note, setNote] = useState(null)
  const [loading, setLoading] = useState(Boolean(noteId))
  const [loadError, setLoadError] = useState("")
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [status, setStatus] = useState("idle") // idle | saving | saved | error
  const [error, setError] = useState("")
  const [sheet, setSheet] = useState(null) // reminder | share | delete
  const [menuOpen, setMenuOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const noteRef = useRef(null)
  const text = useRef({ title: "", content: "" })
  const dirty = useRef(false)
  const timer = useRef(null)
  const inflight = useRef(null)
  const body = useRef(null)
  const titleInput = useRef(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const accept = useCallback((saved) => {
    noteRef.current = saved
    setNote(saved)
    onChangeRef.current?.(saved)
    announceNotesChanged({ related: saved.related, id: saved._id })
  }, [])

  // Load an existing note.
  useEffect(() => {
    if (!noteId) {
      if (autoFocus) titleInput.current?.focus()
      return
    }
    let cancelled = false
    api
      .get(`/notes/${noteId}`)
      .then(({ note: n }) => {
        if (cancelled) return
        noteRef.current = n
        text.current = { title: n.title || "", content: n.content || "" }
        setNote(n)
        setTitle(n.title || "")
        setContent(n.content || "")
      })
      .catch((err) => !cancelled && setLoadError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [noteId, autoFocus])

  // Autosave: one request at a time; whatever changed meanwhile goes next.
  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    if (inflight.current) await inflight.current.catch(() => {})
    // View-only: nothing of ours to save (the server would refuse it anyway).
    if (noteRef.current?.access && !noteRef.current.access.canEdit) dirty.current = false
    if (!dirty.current) return noteRef.current
    const { title: tt, content: cc } = text.current
    const current = noteRef.current
    const empty = !tt.trim() && !cc.trim()
    // An empty new note is never created; an existing one keeps its last text
    // unless it still has something else in it (files, checklist).
    if (empty && (!current || !(current.attachments?.length || current.voiceNote || current.checklistItems?.length))) {
      dirty.current = false
      setStatus("idle")
      return current
    }
    dirty.current = false
    setStatus("saving")
    const payload = current
      ? { title: tt, content: cc }
      : { kind: "note", title: tt, content: cc, ...(related ? { relatedEntityType: related.type, relatedEntityId: related.id } : {}) }
    const request = saveNote(current?._id, payload)
    inflight.current = request
    let failed = false
    try {
      const { note: saved } = await request
      accept(saved)
      setError("")
      setStatus(dirty.current ? "saving" : "saved")
    } catch (err) {
      failed = true
      dirty.current = true
      setError(err.message)
      setStatus("error")
    } finally {
      inflight.current = null
    }
    if (dirty.current && !failed) timer.current = setTimeout(() => flush(), 400)
    return noteRef.current
  }, [accept, related])

  const edit = (field, value) => {
    if (noteRef.current?.access && !noteRef.current.access.canEdit) return
    text.current = { ...text.current, [field]: value }
    if (field === "title") setTitle(value)
    else setContent(value)
    dirty.current = true
    setStatus("saving")
    clearTimeout(timer.current)
    timer.current = setTimeout(() => flush(), 700)
  }

  // Save what's typed when leaving (back button, switching notes, closing).
  useEffect(() => () => void flush(), [flush])
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flush()
    document.addEventListener("visibilitychange", onHide)
    return () => document.removeEventListener("visibilitychange", onHide)
  }, [flush])

  // The text area grows with its content.
  useLayoutEffect(() => {
    const el = body.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.max(el.scrollHeight, 180)}px`
  }, [content, loading])

  // Any other change (pin, reminder, share, archive…) — after pending text.
  const act = async (changes) => {
    const current = await flush()
    if (!current) return null
    const { note: saved } = await saveNote(current._id, changes)
    accept(saved)
    return saved
  }
  const run = (changes) => {
    setMenuOpen(false)
    act(changes).catch((err) => setError(err.message))
  }

  const back = async () => {
    await flush()
    onBack?.()
  }

  const remove = async () => {
    const id = noteRef.current?._id
    if (!id) return onBack?.()
    try {
      await api.delete(`/notes/${id}`)
      dirty.current = false
      noteRef.current = null
      announceNotesChanged({ id, deleted: true, related: note?.related })
      onDeleted?.(id)
    } catch (err) {
      setSheet(null)
      setError(err.message)
    }
  }

  const upload = async (files) => {
    const current = await flush()
    if (!current) return
    const chosen = [...files]
    const tooBig = chosen.find((f) => f.size > MAX_MB * 1024 * 1024)
    if (tooBig) return setError(t("notesPage.fileTooBig", { name: tooBig.name }))
    try {
      let saved = current
      for (const f of chosen.slice(0, LIMITS.attachments - (current.attachments?.length || 0))) saved = (await uploadNoteFile(current._id, f)).note
      accept(saved)
      setError("")
    } catch (err) {
      setError(err.message)
    }
  }

  const removeFile = async (fileId) => {
    try {
      accept((await api.delete(`/notes/${noteRef.current._id}/attachments/${fileId}`)).note)
    } catch (err) {
      setError(err.message)
    }
  }

  const saveVoice = async (voice) => {
    if (!voice?.blob) return
    // A new note is saved first (it needs an id to attach to).
    const current = await flush()
    if (!current) return
    try {
      accept((await uploadNoteFile(current._id, voice.blob, { kind: "voice", durationSec: voice.durationSec })).note)
    } catch (err) {
      setError(err.message)
    }
  }

  const toggleItem = (item) =>
    run({ checklistItems: note.checklistItems.map((i) => (i._id === item._id ? { ...i, completed: !i.completed } : i)) })

  const exists = Boolean(note?._id)
  // A note that's still loading shows no creator-only controls. What the
  // viewer may do comes from the server (note.access); a brand-new note is
  // the viewer's own.
  const owner = exists ? note.isOwner : !noteId
  const canEdit = exists ? Boolean(note.access?.canEdit) : !noteId
  const canShare = exists ? Boolean(note.access?.canShare) : !noteId && can("notes.share")
  const canDelete = exists && Boolean(note.access?.canDelete)
  const readOnly = exists && !canEdit
  const hasText = Boolean(title.trim() || content.trim())
  const reminderOn = exists && note.reminder?.enabled && note.reminder.nextAt
  const sharing = note?.sharing || { visibility: "private", roles: [], users: [], allowEditing: false }
  const shared = sharing.visibility === "shared"
  const recipientLine = useRecipientLine(sharing)
  const today = getNorwayNow().date

  if (loadError) {
    return (
      <div className="flex h-full flex-col">
        {onBack && (
          <div className="flex items-center px-[8px] py-[6px]">
            <button type="button" onClick={onBack} className="flex h-[44px] items-center gap-[2px] rounded-full px-[6px] text-[15px] font-[600] text-[#ff4b00]">
              <ChevronLeft size={22} /> {t("notesPage.back")}
            </button>
          </div>
        )}
        <p role="alert" className="p-[20px] text-[14px] text-red-300">
          {loadError}
        </p>
      </div>
    )
  }

  const statusText = status === "saving" ? t("notesPage.saving") : status === "saved" ? t("notesPage.saved") : status === "error" ? t("notesPage.saveFailed") : ""

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-[2px] border-b border-white/[0.06] px-[6px] py-[6px] sm:px-[10px]">
        {onBack ? (
          <button type="button" onClick={back} className="flex h-[44px] items-center gap-[2px] rounded-full pl-[2px] pr-[10px] text-[15px] font-[600] text-[#ff4b00] hover:bg-white/[0.05]">
            <ChevronLeft size={22} /> {t("notesPage.back")}
          </button>
        ) : (
          <span className="w-[6px]" />
        )}
        <span className={`min-w-0 flex-1 truncate px-[6px] text-[12px] ${status === "error" ? "text-red-300" : "text-white/40"}`} aria-live="polite">
          {statusText}
          {status === "error" && (
            <button type="button" onClick={() => flush()} className="ml-[8px] font-[700] text-[#ff4b00] underline-offset-2 hover:underline">
              {t("notesPage.retry")}
            </button>
          )}
        </span>
        {owner && canEdit && (
          <button
            type="button"
            className={`${iconBtn} ${reminderOn ? "text-[#ff9b6a]" : plain}`}
            disabled={!exists && !hasText}
            onClick={() => setSheet("reminder")}
            aria-label={t("notesPage.reminder")}
            title={t("notesPage.reminder")}
          >
            <Bell size={19} fill={reminderOn ? "currentColor" : "none"} />
          </button>
        )}
        {owner && canShare && (
          <button
            type="button"
            className={`${iconBtn} ${shared ? "text-sky-300" : plain}`}
            disabled={!exists && !hasText}
            onClick={() => setSheet("share")}
            aria-label={`${t("notesPage.sharingSettings")}: ${shareSummary(sharing)}`}
            title={shareSummary(sharing)}
          >
            <ShareIcon sharing={sharing} size={18} />
          </button>
        )}
        <div className="relative">
          <button
            type="button"
            className={`${iconBtn} ${plain}`}
            disabled={!exists && !hasText}
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={t("notesPage.menu")}
          >
            <MoreHorizontal size={20} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-[60]" onClick={() => setMenuOpen(false)} aria-hidden="true" />
              <div role="menu" className="absolute right-0 top-[46px] z-[61] w-[220px] overflow-hidden rounded-[14px] border border-white/10 bg-[#1d1e1e] py-[4px] shadow-2xl">
                <MenuItem icon={note?.isPinned ? PinOff : Pin} onClick={() => run({ isPinned: !note?.isPinned })}>
                  {note?.isPinned ? t("notesPage.unpin") : t("notesPage.pin")}
                </MenuItem>
                {owner && canEdit && (
                  <MenuItem icon={note?.archived ? ArchiveRestore : Archive} onClick={() => run({ archived: !note?.archived })}>
                    {note?.archived ? t("notesPage.restore") : t("notesPage.archive")}
                  </MenuItem>
                )}
                {exists && (
                  <MenuItem
                    icon={History}
                    onClick={() => {
                      setMenuOpen(false)
                      setSheet("history")
                    }}
                  >
                    {t("notesPage.history")}
                  </MenuItem>
                )}
                {owner && canEdit && (
                  <MenuItem
                    icon={SlidersHorizontal}
                    onClick={() => {
                      setMenuOpen(false)
                      setMoreOpen((v) => !v)
                    }}
                  >
                    {moreOpen ? t("notesPage.hideMoreOptions") : t("notesPage.moreOptions")}
                  </MenuItem>
                )}
                {canDelete && (
                  <MenuItem
                    icon={Trash2}
                    danger
                    onClick={() => {
                      setMenuOpen(false)
                      setSheet("delete")
                    }}
                  >
                    {t("notesPage.delete")}
                  </MenuItem>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <p className="p-[20px] text-[14px] text-white/40">{t("notesPage.loading")}</p>
        ) : (
          <div className="mx-auto w-full max-w-[760px] px-[16px] pb-[40px] pt-[12px] sm:px-[24px]">
            <div className="mb-[8px] flex flex-wrap items-center gap-[6px] text-[12px] text-white/40">
              {exists && <span>{formatInstantDateTime(note.updatedAt, { dateStyle: "medium" })}</span>}
              {exists && note.isOwner && shared && (
                <button type="button" onClick={() => canShare && setSheet("share")} className="text-sky-300/80 hover:underline disabled:no-underline" disabled={!canShare}>
                  · {t("notesPage.sharedWithList", { list: shareSummary(sharing) })}
                  {" · "}
                  {sharing.allowEditing ? t("notesPage.accessCanEdit") : t("notesPage.accessViewOnly")}
                </button>
              )}
              <AccessBadge note={exists ? note : null} />
            </div>
            {exists && <NoteAuthorship note={note} className="mb-[10px]" />}
            {readOnly && (
              <p className="mb-[12px] rounded-[10px] bg-sky-400/10 px-[12px] py-[9px] text-[13px] text-sky-100/80">
                {t("notesPage.viewOnlyBanner", { name: note.createdByName })}
              </p>
            )}

            {(note?.related || related) && (
              <div className="mb-[10px] flex flex-wrap items-center gap-[8px]">
                {note?.related ? <RelatedChip related={note.related} /> : <span className="text-[12px] text-white/45">{t("notesPage.linkedRecord")}</span>}
                {note?.related?.id && (
                  <Link href={relatedHref(note.related, base)} className="inline-flex items-center gap-[4px] text-[12px] font-[600] text-[#ff4b00] hover:underline">
                    <ExternalLink size={12} /> {t("notesPage.openRecord")}
                  </Link>
                )}
              </div>
            )}

            {note?.archived && (
              <p className="mb-[10px] rounded-[10px] bg-white/[0.05] px-[12px] py-[9px] text-[13px] text-white/60">
                {note.archiveReason === "expired" ? t("notesPage.expired") : t("notesPage.archivedNote")}
              </p>
            )}

            {reminderOn && (
              <button
                type="button"
                onClick={() => owner && setSheet("reminder")}
                className="mb-[12px] flex w-full min-w-0 flex-col items-start gap-[2px] rounded-[12px] bg-[#ff4b00]/10 px-[12px] py-[9px] text-left"
              >
                <span className="flex items-center gap-[6px] text-[13px] font-[700] text-[#ffb08a]">
                  <Bell size={14} /> {t("notesPage.reminderSet", { when: formatInstantDateTime(note.reminder.nextAt) })}
                  {note.reminder.recurrence !== "none" && <span className="font-[500] text-[#ffb08a]/80">· {t(`notesPage.repeat_${note.reminder.recurrence}`)}</span>}
                </span>
                {owner && <span className="break-all text-[12px] text-white/50">{recipientLine}</span>}
              </button>
            )}

            <input
              ref={titleInput}
              value={title}
              onChange={(e) => edit("title", e.target.value)}
              onBlur={() => flush()}
              readOnly={readOnly}
              aria-readonly={readOnly || undefined}
              maxLength={LIMITS.title}
              placeholder={t("notesPage.titlePlaceholderSimple")}
              aria-label={t("notesPage.title")}
              className="w-full bg-transparent text-[24px] font-[800] leading-[1.25] text-white outline-none placeholder:text-white/25"
            />
            <textarea
              ref={body}
              value={content}
              onChange={(e) => edit("content", e.target.value)}
              onBlur={() => flush()}
              readOnly={readOnly}
              aria-readonly={readOnly || undefined}
              maxLength={LIMITS.content}
              placeholder={t("notesPage.bodyPlaceholder")}
              aria-label={t("notesPage.content")}
              className="mt-[10px] block w-full resize-none overflow-hidden bg-transparent text-[16px] leading-[1.6] text-white/90 outline-none placeholder:text-white/25"
            />

            {/* Checklists from before to-dos had their own page. */}
            {note?.checklistItems?.length > 0 && (
              <ul className="mt-[12px] flex flex-col gap-[2px]" aria-label={t("notesPage.legacyChecklist")}>
                {note.checklistItems.map((item) => (
                  <li key={item._id}>
                    <button type="button" onClick={() => toggleItem(item)} disabled={readOnly} className="flex min-h-[44px] w-full items-center gap-[10px] rounded-[10px] px-[4px] text-left hover:bg-white/[0.04] disabled:hover:bg-transparent" aria-pressed={item.completed}>
                      {item.completed ? <CheckCircle2 size={20} className="shrink-0 text-emerald-400" /> : <Circle size={20} className="shrink-0 text-white/35" />}
                      <span className={`text-[15px] ${item.completed ? "text-white/40 line-through" : "text-white/85"}`}>{item.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Attach a file / record a voice note — always in view for
                whoever may edit the note (never hidden behind "More"). */}
            {owner && canEdit && (
              <AttachmentBar
                disabled={!exists && !hasText}
                canAddFile={!exists || (note.attachments?.length || 0) < LIMITS.attachments}
                onFiles={upload}
                onVoice={saveVoice}
              />
            )}

            {exists && (note.attachments?.length > 0 || note.voiceNote) && (
              <div className="mt-[14px] flex flex-col gap-[10px]">
                {note.voiceNote && (
                  <div className="flex flex-wrap items-center gap-[10px]">
                    <VoicePlayer key={note.voiceNote._id} noteId={note._id} voice={note.voiceNote} />
                    {owner && canEdit && (
                      <button type="button" onClick={() => removeFile("voice")} className="text-[12.5px] font-[600] text-red-300 hover:underline">
                        {t("notesPage.removeVoice")}
                      </button>
                    )}
                  </div>
                )}
                {note.attachments?.length > 0 && (
                  <ul className="flex flex-col gap-[6px]">
                    {note.attachments.map((f) => (
                      <Attachment key={f._id} noteId={note._id} file={f} onRemove={owner && canEdit ? removeFile : null} />
                    ))}
                  </ul>
                )}
              </div>
            )}

            {moreOpen && owner && canEdit && (
              <section className="mt-[20px] flex flex-col gap-[16px] rounded-[14px] border border-white/[0.08] p-[14px]" aria-label={t("notesPage.moreOptions")}>
                {!exists ? (
                  <p className="text-[13px] text-white/45">{t("notesPage.bodyPlaceholder")}</p>
                ) : (
                  <>
                    <label className="block">
                      <span className="mb-[8px] block text-[12px] font-[700] uppercase tracking-[0.08em] text-white/40">{t("notesPage.expiresOptional")}</span>
                      <input
                        type="date"
                        min={addDays(today, 1)}
                        defaultValue={note.expiresAt ? osloParts(note.expiresAt).date : ""}
                        onChange={(e) => run({ expiresAt: e.target.value ? { date: e.target.value } : null })}
                        className="h-[44px] rounded-[10px] border border-white/15 bg-white/[0.04] px-[12px] text-[15px] text-white outline-none [color-scheme:dark] focus:border-[#ff4b00]"
                      />
                    </label>
                  </>
                )}
              </section>
            )}

            {error && (
              <p role="alert" className="mt-[14px] text-[13px] text-red-300">
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      {sheet === "reminder" && (
        <ReminderPicker reminder={note?.reminder} sharing={sharing} onSave={(reminder) => act({ reminder })} onClose={() => setSheet(null)} />
      )}
      {sheet === "share" && <SharePicker sharing={note?.sharing} onSave={(value) => act({ sharing: value })} onClose={() => setSheet(null)} />}
      {sheet === "history" && exists && <NoteHistory noteId={note._id} onClose={() => setSheet(null)} />}
      {sheet === "delete" && (
        <Sheet title={t("notesPage.deleteTitle")} onClose={() => setSheet(null)}>
          <p className="text-[14px] leading-[1.5] text-white/60">{t("notesPage.deleteBody")}</p>
          <div className="mt-[16px] flex flex-col gap-[8px] sm:flex-row-reverse">
            <button type="button" onClick={remove} className="h-[48px] flex-1 rounded-[12px] bg-red-600 text-[15px] font-[800] text-white hover:bg-red-500">
              {t("notesPage.deletePermanently")}
            </button>
            <button type="button" onClick={() => setSheet(null)} className="h-[48px] flex-1 rounded-[12px] bg-white/[0.06] text-[15px] font-[700] text-white/80 hover:bg-white/[0.1]">
              {t("notesPage.cancel")}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

function MenuItem({ icon: Icon, onClick, children, danger = false }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex min-h-[46px] w-full items-center gap-[12px] px-[14px] text-left text-[14.5px] font-[600] hover:bg-white/[0.06] ${danger ? "text-red-300" : "text-white/85"}`}
    >
      <Icon size={17} className="shrink-0 opacity-80" /> {children}
    </button>
  )
}
