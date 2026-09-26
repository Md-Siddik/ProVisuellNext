"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useAuth } from "@/context/AuthContext"

// App-wide Notes controller: any page can open a new note (optionally linked
// to a record) or an existing one.
//   enabled  may write notes ("notes.create") — quick note, "Add note" buttons
//   canView  may open notes at all ("notes.view") — incl. notes shared with them
// For everyone else nothing renders. The API enforces the same permissions,
// and note privacy, on every request.
const NoteEditor = dynamic(() => import("@/components/notes/NoteEditor"), { ssr: false })

const NotesContext = createContext({ enabled: false, canView: false, openNewNote: () => {}, openNote: () => {}, editNote: () => {} })

// Full screen on phones, a panel on the right from `sm` up.
function NotePanel({ children, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !document.querySelector('[role="dialog"][aria-modal="true"]') && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[70] flex justify-end sm:bg-black/55" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex h-full w-full flex-col bg-[#0d0d0d] pt-[env(safe-area-inset-top)] sm:max-w-[560px] sm:border-l sm:border-white/10 sm:pt-0">{children}</div>
    </div>
  )
}

export function NotesProvider({ children }) {
  const { can, needsEmailVerification, isAuthenticated } = useAuth()
  const signedIn = isAuthenticated && !needsEmailVerification
  const canView = signedIn && can("notes.view")
  const enabled = canView && can("notes.create")
  const [panel, setPanel] = useState(null) // { key, id?, related? }

  // related: { type, id } — the server looks the record up and labels it.
  const openNewNote = useCallback((related = null) => enabled && setPanel({ key: Date.now(), related }), [enabled])
  const openNote = useCallback((id) => setPanel({ key: Date.now(), id }), [])
  const editNote = useCallback((note) => setPanel({ key: Date.now(), id: note?._id }), [])
  const close = useCallback(() => setPanel(null), [])

  const value = useMemo(() => ({ enabled, canView, openNewNote, openNote, editNote }), [enabled, canView, openNewNote, openNote, editNote])

  return (
    <NotesContext.Provider value={value}>
      {children}
      {canView && panel && (
        <NotePanel onClose={close}>
          <NoteEditor key={panel.key} noteId={panel.id || null} related={panel.related || null} autoFocus={!panel.id} onBack={close} onDeleted={close} />
        </NotePanel>
      )}
    </NotesContext.Provider>
  )
}

export function useNotes() {
  return useContext(NotesContext)
}
