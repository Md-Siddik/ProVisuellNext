"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Bell, Check, ChevronDown, ChevronRight, ListChecks, Plus, Trash2, Users } from "lucide-react"
import { api } from "@/lib/api"
import { getLocale } from "@/lib/i18n/locale"
import { useTranslation } from "@/lib/i18n"
import { useTimeFormat } from "@/context/TimeFormatContext"
import { addDays, formatDateString, getNorwayNow, weekdayIndex } from "@/lib/appointments/time"
import { LIMITS } from "@/lib/notes/core"
import { NOTES_CHANGED_EVENT, announceNotesChanged, fetchAudience, saveNote } from "@/lib/notes/client"
import { RelatedChip } from "@/components/notes/noteUi"
import ReminderPicker from "@/components/notes/ReminderPicker"
import SharePicker from "@/components/notes/SharePicker"
import { AccessBadge, NoteAuthorship, ShareIcon, useShareSummary } from "@/components/notes/sharing"
import { useNotes } from "@/context/NotesContext"
import { useRefetchOnReturn } from "@/hooks/useRefetchOnReturn"
import Sheet from "@/components/notes/Sheet"

// Pending first (soonest due date first, undated last), newest completed first.
function sortPending(a, b) {
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1
  if (a.dueDate && !b.dueDate) return -1
  if (!a.dueDate && b.dueDate) return 1
  return new Date(b.createdAt) - new Date(a.createdAt)
}
const sortDone = (a, b) => new Date(b.completedAt || b.updatedAt) - new Date(a.completedAt || a.updatedAt)

function useDueLabel() {
  const { t } = useTranslation()
  return (dueDate) => {
    const locale = getLocale()
    if (!dueDate) return null
    const today = getNorwayNow().date
    const pretty = formatDateString(dueDate, locale, { weekday: "short", day: "numeric", month: "short" })
    if (dueDate < today) return { text: t("todoPage.overdue", { date: pretty }), tone: "text-red-300" }
    if (dueDate === today) return { text: t("todoPage.dueToday"), tone: "text-[#ff9b6a]" }
    if (dueDate === addDays(today, 1)) return { text: t("todoPage.dueTomorrow"), tone: "text-white/60" }
    return { text: pretty, tone: "text-white/50" }
  }
}

function Checkbox({ checked, onToggle, label, disabled = false }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      disabled={disabled}
      className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-[#ff4b00] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className={`flex h-[24px] w-[24px] items-center justify-center rounded-full border-2 transition-colors ${checked ? "border-[#ff4b00] bg-[#ff4b00]" : "border-white/35 hover:border-white/60"}`}>
        {checked && <Check size={15} strokeWidth={3} className="text-white" />}
      </span>
    </button>
  )
}

function TodoRow({ todo, onToggle, onOpen }) {
  const canEdit = todo.access ? todo.access.canEdit : true
  const { t } = useTranslation()
  const dueLabel = useDueLabel()
  const due = dueLabel(todo.dueDate)
  const reminder = todo.reminder?.enabled && todo.reminder.nextAt
  const shared = todo.sharing ? todo.sharing.visibility === "shared" : todo.sharedWith !== "private"
  return (
    <li className="flex items-center gap-[2px] pr-[6px]">
      <Checkbox checked={todo.isCompleted} disabled={!canEdit} onToggle={() => onToggle(todo)} label={todo.isCompleted ? t("todoPage.markUndone") : t("todoPage.markDone")} />
      <button type="button" onClick={() => onOpen(todo._id)} className="flex min-h-[56px] min-w-0 flex-1 items-center gap-[8px] py-[8px] text-left" aria-label={`${todo.title} — ${t("todoPage.open")}`}>
        <span className="min-w-0 flex-1">
          <span className={`block break-words text-[15px] leading-[1.35] ${todo.isCompleted ? "text-white/40 line-through" : "text-white"}`}>{todo.title}</span>
          {(due || reminder || shared || !todo.isOwner) && (
            <span className="mt-[2px] flex flex-wrap items-center gap-x-[8px] gap-y-[2px] text-[12.5px]">
              {due && !todo.isCompleted && <span className={due.tone}>{due.text}</span>}
              {reminder && <Bell size={12} className="text-[#ff9b6a]" aria-label={t("notesPage.reminder")} />}
              {shared && <Users size={12} className="text-sky-300" aria-label={t("notesPage.shared")} />}
              {!todo.isOwner && (
                <span className="text-sky-300/80">
                  {t("notesPage.sharedBy", { name: todo.createdByName })} · {canEdit ? t("notesPage.accessCanEdit") : t("notesPage.accessViewOnly")}
                </span>
              )}
            </span>
          )}
        </span>
        <ChevronRight size={16} className="shrink-0 text-white/25" />
      </button>
    </li>
  )
}

// Details of one to-do: task, note, due date, reminder, sharing.
function TodoSheet({ todo, onChange, onDeleted, onClose }) {
  const { t } = useTranslation()
  const { formatInstantDateTime } = useTimeFormat()
  const dueLabel = useDueLabel()
  const [title, setTitle] = useState(todo.title)
  const [content, setContent] = useState(todo.content || "")
  const [picker, setPicker] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState("")
  const today = getNorwayNow().date
  const owner = todo.isOwner
  // What the viewer may do comes from the server (todo.access).
  const canEdit = todo.access ? todo.access.canEdit : owner
  const canShare = todo.access ? todo.access.canShare : owner
  const canDelete = todo.access ? todo.access.canDelete : owner
  const shareSummary = useShareSummary()
  const sharing = todo.sharing || { visibility: "private", roles: [], users: [], allowEditing: false }

  const patch = async (changes) => {
    setError("")
    try {
      const { note } = await saveNote(todo._id, changes)
      onChange(note)
      return note
    } catch (err) {
      setError(err.message)
      throw err
    }
  }

  const saveText = () => {
    if (!canEdit) return
    const changes = {}
    if (title.trim() && title !== todo.title) changes.title = title
    if (content !== (todo.content || "")) changes.content = content
    if (Object.keys(changes).length) patch(changes).catch(() => {})
  }
  const close = () => {
    saveText()
    onClose()
  }

  const remove = async () => {
    try {
      await api.delete(`/notes/${todo._id}`)
      onDeleted(todo._id)
    } catch (err) {
      setError(err.message)
    }
  }

  const dueChips = [
    { key: "dueToday", date: today },
    { key: "dueTomorrow", date: addDays(today, 1) },
    { key: "nextWeek", date: addDays(today, 7 - weekdayIndex(today)) },
  ]
  const due = dueLabel(todo.dueDate)
  const reminderOn = todo.reminder?.enabled && todo.reminder.nextAt

  if (picker === "reminder") return <ReminderPicker reminder={todo.reminder} sharing={sharing} onSave={(reminder) => patch({ reminder })} onClose={() => setPicker(null)} />
  if (picker === "share") return <SharePicker sharing={todo.sharing} onSave={(value) => patch({ sharing: value })} onClose={() => setPicker(null)} />

  return (
    <Sheet title={t("todoPage.details")} onClose={close}>
      <div className="flex items-start gap-[4px]">
        <div className="-ml-[10px]">
          <Checkbox checked={todo.isCompleted} disabled={!canEdit} onToggle={() => patch({ isCompleted: !todo.isCompleted }).catch(() => {})} label={todo.isCompleted ? t("todoPage.markUndone") : t("todoPage.markDone")} />
        </div>
        <textarea
          value={title}
          readOnly={!canEdit}
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
          onBlur={saveText}
          rows={2}
          maxLength={LIMITS.title}
          aria-label={t("todoPage.task")}
          className="mt-[10px] min-w-0 flex-1 resize-none bg-transparent text-[17px] font-[700] leading-[1.35] text-white outline-none"
        />
      </div>
      {!owner && <AccessBadge note={todo} className="mb-[8px]" />}
      <NoteAuthorship note={todo} className="mb-[10px]" />
      {todo.related && (
        <div className="mb-[10px]">
          <RelatedChip related={todo.related} />
        </div>
      )}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={saveText}
        readOnly={!canEdit}
        rows={3}
        maxLength={LIMITS.content}
        placeholder={t("todoPage.notes")}
        aria-label={t("todoPage.notes")}
        className="w-full resize-y rounded-[12px] bg-white/[0.05] px-[12px] py-[10px] text-[15px] leading-[1.5] text-white/90 outline-none placeholder:text-white/30 focus:ring-1 focus:ring-[#ff4b00]/60"
      />

      {owner && canEdit && (
        <div className="mt-[14px]">
          <p className="mb-[8px] text-[12px] font-[700] uppercase tracking-[0.08em] text-white/40">
            {t("todoPage.due")}
            {due && <span className={`ml-[8px] normal-case tracking-normal ${due.tone}`}>{due.text}</span>}
          </p>
          <div className="flex flex-wrap gap-[6px]">
            {dueChips.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => patch({ dueDate: c.date }).catch(() => {})}
                className={`h-[40px] rounded-full px-[14px] text-[13.5px] font-[700] transition-colors ${todo.dueDate === c.date ? "bg-[#ff4b00] text-white" : "bg-white/[0.06] text-white/75 hover:bg-white/[0.1]"}`}
              >
                {t(c.key === "nextWeek" ? "todoPage.nextWeek" : `todoPage.${c.key}`)}
              </button>
            ))}
            <input
              type="date"
              value={todo.dueDate || ""}
              onChange={(e) => patch({ dueDate: e.target.value || null }).catch(() => {})}
              aria-label={t("todoPage.due")}
              className="h-[40px] rounded-full bg-white/[0.06] px-[12px] text-[13.5px] text-white/80 outline-none [color-scheme:dark]"
            />
            {todo.dueDate && (
              <button type="button" onClick={() => patch({ dueDate: null }).catch(() => {})} className="h-[40px] rounded-full px-[10px] text-[13px] font-[600] text-white/50 hover:text-white">
                {t("todoPage.clearDue")}
              </button>
            )}
          </div>
        </div>
      )}

      {owner && (canEdit || canShare) && (
        <div className="mt-[14px] flex flex-col gap-[6px]">
          {canEdit && <button type="button" onClick={() => setPicker("reminder")} className="flex min-h-[52px] w-full items-center gap-[12px] rounded-[12px] bg-white/[0.04] px-[14px] text-left hover:bg-white/[0.08]">
            <Bell size={17} className={reminderOn ? "text-[#ff9b6a]" : "text-white/50"} />
            <span className="min-w-0 flex-1 text-[14.5px] font-[600] text-white">
              {reminderOn ? t("notesPage.reminderSet", { when: formatInstantDateTime(todo.reminder.nextAt) }) : t("notesPage.reminder")}
            </span>
            <ChevronRight size={16} className="text-white/30" />
          </button>}
          {canShare && <button type="button" onClick={() => setPicker("share")} className="flex min-h-[52px] w-full items-center gap-[12px] rounded-[12px] bg-white/[0.04] px-[14px] text-left hover:bg-white/[0.08]">
            <ShareIcon sharing={sharing} size={17} className={sharing.visibility === "shared" ? "text-sky-300" : "text-white/50"} />
            <span className="min-w-0 flex-1 text-[14.5px] font-[600] text-white">
              {shareSummary(sharing)}
              {sharing.visibility === "shared" && <span className="block text-[12px] font-[500] text-white/45">{sharing.allowEditing ? t("notesPage.accessCanEdit") : t("notesPage.accessViewOnly")}</span>}
            </span>
            <ChevronRight size={16} className="text-white/30" />
          </button>}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-[10px] text-[13px] text-red-300">
          {error}
        </p>
      )}

      {canDelete &&
        (confirmDelete ? (
          <div className="mt-[16px] rounded-[12px] bg-red-500/10 p-[12px]">
            <p className="text-[14px] font-[700] text-white">{t("todoPage.deleteTitle")}</p>
            <p className="mt-[2px] text-[13px] text-white/55">{t("todoPage.deleteBody")}</p>
            <div className="mt-[10px] flex gap-[8px]">
              <button type="button" onClick={remove} className="h-[44px] flex-1 rounded-[10px] bg-red-600 text-[14px] font-[800] text-white hover:bg-red-500">
                {t("todoPage.delete")}
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="h-[44px] flex-1 rounded-[10px] bg-white/[0.07] text-[14px] font-[700] text-white/80">
                {t("notesPage.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="mt-[16px] flex h-[46px] w-full items-center justify-center gap-[8px] rounded-[12px] text-[14px] font-[700] text-red-300 hover:bg-red-500/10">
            <Trash2 size={16} /> {t("todoPage.delete")}
          </button>
        ))}
    </Sheet>
  )
}

// To-dos: a quick-add field, what's left, and what's done.
export default function Todo() {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [draft, setDraft] = useState("")
  const [adding, setAdding] = useState(false)
  // Without "notes.create" only to-dos shared with the viewer are listed.
  const { enabled: canCreate } = useNotes()
  const [showDone, setShowDone] = useState(false)
  const [openId, setOpenId] = useState(null)
  const [extra, setExtra] = useState(null) // a linked to-do that isn't in the list (yet)
  const input = useRef(null)

  // Warm the sharing counts so the reminder / share sheets open complete.
  useEffect(() => {
    fetchAudience().catch(() => {})
  }, [])

  const load = useCallback(async () => {
    try {
      const d = await api.get("/notes?kind=todo&limit=300")
      setTodos(d.notes)
      setError("")
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // To-dos other people share (or stop sharing) appear without a reload.
  useRefetchOnReturn(load)

  useEffect(() => {
    load()
    let timer
    const onChange = (e) => {
      if (e.detail?.fromTodo) return
      clearTimeout(timer)
      timer = setTimeout(load, 400)
    }
    window.addEventListener(NOTES_CHANGED_EVENT, onChange)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(NOTES_CHANGED_EVENT, onChange)
    }
  }, [load])

  const setUrlTodo = useCallback(
    (id) => {
      const qs = new URLSearchParams(window.location.search)
      if (id) qs.set("todo", id)
      else qs.delete("todo")
      const s = qs.toString()
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false })
    },
    [router, pathname]
  )

  // ?todo=<id> from a reminder email or notification.
  const linked = searchParams.get("todo")
  useEffect(() => {
    if (!linked) return
    setOpenId(linked)
    api
      .get(`/notes/${linked}`)
      .then(({ note }) => setExtra(note))
      .catch((err) => {
        setError(err.message)
        setOpenId(null)
      })
  }, [linked])

  const replace = useCallback((note) => {
    setTodos((prev) => (prev.some((x) => x._id === note._id) ? prev.map((x) => (x._id === note._id ? note : x)) : [note, ...prev]))
    setExtra((x) => (x && x._id === note._id ? note : x))
    announceNotesChanged({ id: note._id, fromTodo: true })
  }, [])

  const add = async (e) => {
    e.preventDefault()
    const title = draft.trim()
    if (!title || adding) return
    setAdding(true)
    try {
      const { note } = await saveNote(null, { kind: "todo", title })
      setTodos((prev) => [note, ...prev])
      setDraft("")
      announceNotesChanged({ id: note._id, fromTodo: true })
      input.current?.focus()
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  const toggle = async (todo) => {
    const next = !todo.isCompleted
    setTodos((prev) => prev.map((x) => (x._id === todo._id ? { ...x, isCompleted: next, completedAt: next ? new Date().toISOString() : null } : x)))
    try {
      replace((await saveNote(todo._id, { isCompleted: next })).note)
    } catch (err) {
      setError(err.message)
      setTodos((prev) => prev.map((x) => (x._id === todo._id ? todo : x)))
    }
  }

  const open = (id) => {
    setOpenId(id)
    setUrlTodo(id)
  }
  const close = () => {
    setOpenId(null)
    setExtra(null)
    setUrlTodo(null)
  }
  const deleted = (id) => {
    setTodos((prev) => prev.filter((x) => x._id !== id))
    announceNotesChanged({ id, deleted: true, fromTodo: true })
    close()
  }

  const pending = useMemo(() => todos.filter((x) => !x.isCompleted).sort(sortPending), [todos])
  const done = useMemo(() => todos.filter((x) => x.isCompleted).sort(sortDone), [todos])
  const current = openId ? todos.find((x) => x._id === openId) || (extra?._id === openId ? extra : null) : null

  return (
    <div className="mx-auto w-full max-w-[680px]">
      <h1 className="pb-[12px] text-[28px] font-[800] tracking-[-0.01em] text-white">{t("todoPage.title")}</h1>

      {canCreate && (
      <form onSubmit={add} className="flex items-center gap-[8px] rounded-[14px] bg-[#141515] p-[6px] pl-[14px] focus-within:ring-1 focus-within:ring-[#ff4b00]/60">
        <Plus size={18} className="shrink-0 text-white/40" />
        <input
          ref={input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={LIMITS.title}
          placeholder={t("todoPage.addPlaceholder")}
          aria-label={t("todoPage.addPlaceholder")}
          className="h-[44px] min-w-0 flex-1 bg-transparent text-[16px] text-white outline-none placeholder:text-white/35"
        />
        <button type="submit" disabled={!draft.trim() || adding} className="h-[44px] shrink-0 rounded-[10px] bg-[#ff4b00] px-[16px] text-[14px] font-[800] text-white transition-colors hover:bg-[#e64400] disabled:opacity-40">
          {t("todoPage.add")}
        </button>
      </form>
      )}

      {error && (
        <p role="alert" className="mt-[10px] text-[13px] text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <p className="py-[20px] text-[14px] text-white/40">{t("notesPage.loading")}</p>
      ) : todos.length === 0 ? (
        <div className="flex flex-col items-center px-[16px] py-[48px] text-center">
          <span className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-[#ff4b00]/12 text-[#ff4b00]">
            <ListChecks size={24} />
          </span>
          <p className="mt-[14px] text-[14px] text-white/50">{t("todoPage.empty")}</p>
        </div>
      ) : (
        <>
          {pending.length > 0 ? (
            <ul className="mt-[12px] divide-y divide-white/[0.06] rounded-[14px] bg-[#141515]">
              {pending.map((x) => (
                <TodoRow key={x._id} todo={x} onToggle={toggle} onOpen={open} />
              ))}
            </ul>
          ) : (
            <p className="py-[24px] text-center text-[14px] text-white/45">{t("todoPage.allDone")}</p>
          )}

          {done.length > 0 && (
            <section className="mt-[18px]" aria-label={t("todoPage.completed", { n: done.length })}>
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                aria-expanded={showDone}
                className="flex h-[44px] items-center gap-[6px] px-[4px] text-[13px] font-[800] uppercase tracking-[0.06em] text-white/45 hover:text-white/70"
              >
                <ChevronDown size={16} className={`transition-transform ${showDone ? "" : "-rotate-90"}`} />
                {t("todoPage.completed", { n: done.length })}
              </button>
              {showDone && (
                <ul className="divide-y divide-white/[0.06] rounded-[14px] bg-[#141515]">
                  {done.map((x) => (
                    <TodoRow key={x._id} todo={x} onToggle={toggle} onOpen={open} />
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      {current && <TodoSheet key={current._id} todo={current} onChange={replace} onDeleted={deleted} onClose={close} />}
    </div>
  )
}
