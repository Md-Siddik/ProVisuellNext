"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Plus, Search, SquarePen, StickyNote, X } from "lucide-react"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { NOTES_CHANGED_EVENT, fetchAudience } from "@/lib/notes/client"
import { RELATED_TYPES } from "@/lib/notes/core"
import { useMediaQuery } from "@/lib/notes/useMediaQuery"
import { useRefetchOnReturn } from "@/hooks/useRefetchOnReturn"
import { NoteRow } from "@/components/notes/noteUi"
import { useNotes } from "@/context/NotesContext"
import NoteEditor from "@/components/notes/NoteEditor"

const TABS = ["all", "pinned", "shared", "archived"]

// Notes, Apple-Notes style: a searchable list and one note at a time.
// Phones: the list, and the note opens full screen. Desktop: list | note.
// Only the viewer's own notes and notes shared with them ever arrive here.
export default function Notes() {
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const desktop = useMediaQuery("(min-width: 1024px)")
  // Without "notes.create" (e.g. a moderator) this page lists notes shared
  // with the viewer only — no way to start a new one.
  const { enabled: canCreate } = useNotes()

  const [tab, setTab] = useState("all")
  const [q, setQ] = useState("")
  const [debounced, setDebounced] = useState("")
  const [related, setRelated] = useState(() => {
    const type = searchParams.get("relatedType")
    return RELATED_TYPES.includes(type) ? { type, id: searchParams.get("relatedId") || "" } : null
  })
  const [data, setData] = useState({ notes: [], pinned: [], total: 0, pages: 1, page: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [open, setOpen] = useState(null) // { key, id } — id null for a new note
  const [activeId, setActiveId] = useState(null)
  const counter = useRef(0)
  const activeRef = useRef(null)
  const openKey = useRef(null)

  const setUrlNote = useCallback(
    (id) => {
      const qs = new URLSearchParams(window.location.search)
      if (id) qs.set("note", id)
      else qs.delete("note")
      const s = qs.toString()
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false })
    },
    [router, pathname]
  )

  const openNote = useCallback((id) => {
    counter.current += 1
    activeRef.current = id
    openKey.current = counter.current
    setActiveId(id)
    setOpen({ key: counter.current, id })
  }, [])

  // ?note=<id> (reminder emails, notifications, the dashboard) opens it.
  const linked = searchParams.get("note")
  useEffect(() => {
    if (linked && linked !== activeRef.current) openNote(linked)
  }, [linked, openNote])

  // Warm the sharing counts so the reminder / share sheets open complete.
  useEffect(() => {
    fetchAudience().catch(() => {})
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q.trim()), 250)
    return () => clearTimeout(timer)
  }, [q])

  const load = useCallback(
    async (page = 1) => {
      const qs = new URLSearchParams({ kind: "note", filter: tab, page: String(page), limit: "30" })
      if (debounced) qs.set("q", debounced)
      if (related) {
        qs.set("relatedType", related.type)
        if (related.id) qs.set("relatedId", related.id)
      }
      try {
        const d = await api.get(`/notes?${qs}`)
        setData((prev) => ({
          notes: page === 1 ? d.notes : [...prev.notes, ...d.notes],
          pinned: page === 1 ? d.pinned || [] : prev.pinned,
          total: d.total,
          pages: d.pages,
          page,
        }))
        setError("")
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    },
    [tab, debounced, related]
  )

  // Notes other people share (or stop sharing) appear without a reload —
  // only while the first page is all that's shown, so nothing loaded is lost.
  useRefetchOnReturn(() => load(1), { enabled: data.page === 1 })

  useEffect(() => {
    setLoading(true)
    load(1)
  }, [load])

  // Notes added elsewhere (e.g. from an order) show up here too.
  useEffect(() => {
    let timer
    const onChange = (e) => {
      // Saves from the note that's open here are already in the list.
      if (e.detail?.id && e.detail.id === activeRef.current) return
      clearTimeout(timer)
      timer = setTimeout(() => load(1), 400)
    }
    window.addEventListener(NOTES_CHANGED_EVENT, onChange)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(NOTES_CHANGED_EVENT, onChange)
    }
  }, [load])

  // The open note was saved: keep the list in step without refetching.
  const upsert = useCallback(
    (note, key) => {
      // A new note got its id — unless the user has already moved on.
      if (key === openKey.current && activeRef.current !== note._id) {
        activeRef.current = note._id
        setActiveId(note._id)
        setUrlNote(note._id)
      }
      setData((prev) => {
        const others = prev.notes.filter((n) => n._id !== note._id)
        const pinnedOthers = prev.pinned.filter((n) => n._id !== note._id)
        const belongs =
          (tab === "archived" ? note.archived : !note.archived) &&
          (tab !== "pinned" || note.isPinned) &&
          (tab !== "shared" || !note.isOwner || note.sharing?.visibility === "shared")
        const known = others.length !== prev.notes.length || pinnedOthers.length !== prev.pinned.length
        if (!belongs) return { ...prev, notes: others, pinned: pinnedOthers, total: known ? prev.total - 1 : prev.total }
        const splitPinned = tab === "all" && !debounced && !related
        if (splitPinned && note.isPinned) return { ...prev, notes: others, pinned: [note, ...pinnedOthers], total: known ? prev.total : prev.total + 1 }
        return { ...prev, pinned: pinnedOthers, notes: [note, ...others], total: known ? prev.total : prev.total + 1 }
      })
    },
    [tab, debounced, related, setUrlNote]
  )

  const close = useCallback(() => {
    activeRef.current = null
    openKey.current = null
    setActiveId(null)
    setOpen(null)
    setUrlNote(null)
  }, [setUrlNote])

  const removed = useCallback(
    (id) => {
      setData((prev) => ({ ...prev, notes: prev.notes.filter((n) => n._id !== id), pinned: prev.pinned.filter((n) => n._id !== id), total: Math.max(0, prev.total - 1) }))
      close()
    },
    [close]
  )

  const newNote = () => {
    if (!canCreate) return
    counter.current += 1
    activeRef.current = null
    openKey.current = counter.current
    setActiveId(null)
    setOpen({ key: counter.current, id: null })
    setUrlNote(null)
  }

  const empty = !loading && !error && data.notes.length === 0 && data.pinned.length === 0
  const emptyText = debounced
    ? t("notesPage.noResults")
    : tab === "pinned"
      ? t("notesPage.emptyPinned")
      : tab === "shared"
        ? t("notesPage.emptyShared")
        : tab === "archived"
          ? t("notesPage.emptyArchived")
          : null

  const editor = open && (
    <NoteEditor
      key={open.key}
      noteId={open.id}
      related={open.id ? null : related?.id ? related : null}
      autoFocus={!open.id}
      onBack={desktop ? undefined : close}
      onChange={(note) => upsert(note, open.key)}
      onDeleted={removed}
    />
  )

  const list = (
    <div className="flex min-h-0 flex-col">
      <div className="flex items-center justify-between gap-[10px] pb-[12px]">
        <h1 className="text-[28px] font-[800] tracking-[-0.01em] text-white">{t("notesPage.title_page")}</h1>
        {canCreate && (
        <button
          type="button"
          onClick={newNote}
          className="hidden h-[42px] w-[42px] items-center justify-center rounded-full text-[#ff4b00] transition-colors hover:bg-white/[0.06] lg:flex"
          aria-label={t("notesPage.newNote")}
          title={t("notesPage.newNote")}
        >
          <SquarePen size={20} />
        </button>
        )}
      </div>

      <label className="relative block">
        <span className="sr-only">{t("notesPage.search")}</span>
        <Search size={17} className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2 text-white/40" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("notesPage.search")}
          className="h-[44px] w-full rounded-[12px] bg-white/[0.06] pl-[38px] pr-[40px] text-[16px] text-white outline-none placeholder:text-white/35 focus:ring-1 focus:ring-[#ff4b00]/60 [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label={t("notesPage.clearSearch")} className="absolute right-[4px] top-1/2 flex h-[36px] w-[36px] -translate-y-1/2 items-center justify-center rounded-full text-white/50 hover:text-white">
            <X size={16} />
          </button>
        )}
      </label>

      <div role="tablist" aria-label={t("notesPage.filters")} className="mt-[10px] grid grid-cols-4 gap-[2px] rounded-[12px] bg-white/[0.05] p-[3px]">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`h-[36px] min-w-0 truncate rounded-[9px] px-[4px] text-[13px] font-[700] transition-colors ${tab === key ? "bg-white/[0.12] text-white" : "text-white/50 hover:text-white/80"}`}
          >
            {t(`notesPage.tab_${key}`)}
          </button>
        ))}
      </div>

      {related && (
        <div className="mt-[10px] flex items-center justify-between gap-[8px] rounded-[10px] bg-[#ff4b00]/10 px-[12px] py-[8px] text-[13px] text-[#ffb08a]">
          <span className="min-w-0 truncate">{t("notesPage.showingRecordNotes")}</span>
          <button type="button" onClick={() => setRelated(null)} className="shrink-0 font-[700] text-[#ff4b00] hover:underline">
            {t("notesPage.clearFilter")}
          </button>
        </div>
      )}

      <div className="mt-[8px] min-h-0 flex-1 lg:overflow-y-auto lg:pr-[4px]">
        {error && (
          <p role="alert" className="px-[4px] py-[12px] text-[13px] text-red-300">
            {error}
          </p>
        )}
        {loading && data.notes.length === 0 && data.pinned.length === 0 && <p className="px-[4px] py-[16px] text-[14px] text-white/40">{t("notesPage.loading")}</p>}

        {empty &&
          (emptyText ? (
            <p className="px-[4px] py-[28px] text-center text-[14px] text-white/45">{emptyText}</p>
          ) : (
            <div className="flex flex-col items-center px-[16px] py-[48px] text-center">
              <span className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-[#ff4b00]/12 text-[#ff4b00]">
                <StickyNote size={24} />
              </span>
              <p className="mt-[14px] text-[16px] font-[800] text-white">{t("notesPage.emptyTitle")}</p>
              <p className="mt-[4px] text-[14px] text-white/50">{canCreate ? t("notesPage.emptyHint") : t("notesPage.emptyHintViewer")}</p>
              {canCreate && <button type="button" onClick={newNote} className="mt-[16px] inline-flex h-[44px] items-center gap-[8px] rounded-full bg-[#ff4b00] px-[18px] text-[14px] font-[800] text-white hover:bg-[#e64400]">
                <Plus size={17} /> {t("notesPage.newNote")}
              </button>}
            </div>
          ))}

        {data.pinned.length > 0 && (
          <section aria-label={t("notesPage.pinned")} className="mb-[8px]">
            <h2 className="px-[14px] pb-[4px] pt-[8px] text-[12px] font-[800] uppercase tracking-[0.08em] text-white/40">{t("notesPage.pinned")}</h2>
            <ul className="divide-y divide-white/[0.06] rounded-[14px] bg-[#141515]">
              {data.pinned.map((n) => (
                <li key={n._id}>
                  <NoteRow note={n} onOpen={openNote} selected={desktop && n._id === activeId} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.notes.length > 0 && (
          <section aria-label={t("notesPage.notes")}>
            {data.pinned.length > 0 && <h2 className="px-[14px] pb-[4px] pt-[8px] text-[12px] font-[800] uppercase tracking-[0.08em] text-white/40">{t("notesPage.notes")}</h2>}
            <ul className="divide-y divide-white/[0.06] rounded-[14px] bg-[#141515]">
              {data.notes.map((n) => (
                <li key={n._id}>
                  <NoteRow note={n} onOpen={openNote} selected={desktop && n._id === activeId} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.page < data.pages && (
          <button type="button" onClick={() => load(data.page + 1)} className="mt-[10px] h-[44px] w-full rounded-[12px] bg-white/[0.05] text-[14px] font-[700] text-white/70 hover:bg-white/[0.09]">
            {t("notesPage.loadMore")}
          </button>
        )}
        <div className="h-[90px] lg:hidden" aria-hidden="true" />
      </div>
    </div>
  )

  if (desktop) {
    return (
      <div className="-m-[32px] flex h-[calc(100dvh-72px)] min-h-[480px]">
        <div className="flex w-[340px] shrink-0 flex-col border-r border-white/[0.07] p-[20px] xl:w-[380px]">{list}</div>
        <div className="min-w-0 flex-1 bg-[#0f1010]">
          {editor || (
            <div className="flex h-full flex-col items-center justify-center gap-[12px] p-[24px] text-center">
              <StickyNote size={30} className="text-white/15" />
              <p className="text-[14px] text-white/40">{canCreate ? t("notesPage.emptySelect") : t("notesPage.emptySelectViewer")}</p>
              {canCreate && <button type="button" onClick={newNote} className="inline-flex h-[42px] items-center gap-[8px] rounded-full bg-white/[0.07] px-[16px] text-[14px] font-[700] text-white/80 hover:bg-white/[0.11]">
                <Plus size={16} /> {t("notesPage.newNote")}
              </button>}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[680px]">
      {list}
      {canCreate && <button
        type="button"
        onClick={newNote}
        aria-label={t("notesPage.newNote")}
        className="fixed bottom-[max(20px,env(safe-area-inset-bottom))] right-[20px] z-[40] flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#ff4b00] text-white shadow-[0_8px_24px_rgba(255,75,0,0.35)] transition-transform active:scale-95"
      >
        <Plus size={26} />
      </button>}
      {editor && <div className="fixed inset-0 z-[70] flex flex-col bg-[#0d0d0d] pt-[env(safe-area-inset-top)]">{editor}</div>}
    </div>
  )
}
