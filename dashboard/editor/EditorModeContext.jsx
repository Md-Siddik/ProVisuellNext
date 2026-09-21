"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"

// Default (no provider) = editor UI completely off. Every marketing
// component reads this so the exact same JSX renders the plain public site
// when there's no EditorModeProvider around it, and the editable version
// only inside the Website Editor dashboard page.
const EditorModeContext = createContext({
  enabled: false,
  language: "no",
  saveText: async () => {},
  saveImage: async () => {},
  saveVideo: async () => {},
})

export function useEditorMode() {
  return useContext(EditorModeContext)
}

export function EditorModeProvider({ children }) {
  const { language, refreshContent, t } = useTranslation()
  const [toast, setToast] = useState(null)

  const notify = useCallback((kind, message) => {
    setToast({ kind, message, id: Date.now() })
  }, [])

  const saveText = useCallback(
    async (key, value) => {
      const trimmed = value.trim()
      if (!trimmed) throw new Error(t("editor.textEmpty"))
      await api.put(`/site-content/${encodeURIComponent(key)}`, { value: trimmed, language, type: "text" })
      await refreshContent()
      notify("success", t("editor.saved"))
    },
    [language, refreshContent, notify, t]
  )

  const saveImage = useCallback(
    async (key, file) => {
      const fd = new FormData()
      fd.append("file", file)
      const { url } = await api.postForm("/site-content/upload-media", fd)
      await api.put(`/site-content/${encodeURIComponent(key)}`, { value: url, type: "image" })
      await refreshContent()
      notify("success", t("editor.imageUpdated"))
    },
    [refreshContent, notify, t]
  )

  const saveVideo = useCallback(
    async (key, file) => {
      const fd = new FormData()
      fd.append("file", file)
      const { url } = await api.postForm("/site-content/upload-media", fd)
      await api.put(`/site-content/${encodeURIComponent(key)}`, { value: url, type: "video" })
      await refreshContent()
      notify("success", t("editor.videoUpdated"))
    },
    [refreshContent, notify, t]
  )

  const value = useMemo(
    () => ({ enabled: true, language, saveText, saveImage, saveVideo, notify }),
    [language, saveText, saveImage, saveVideo, notify]
  )

  return (
    <EditorModeContext.Provider value={value}>
      {children}
      {toast && <Toast toast={toast} onDone={() => setToast(null)} />}
    </EditorModeContext.Provider>
  )
}

function Toast({ toast, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200)
    return () => clearTimeout(t)
  }, [toast, onDone])
  return (
    <div
      className={`fixed bottom-[24px] right-[24px] z-[999] rounded-[10px] px-[16px] py-[11px] text-[13px] font-[600] text-white shadow-xl ${
        toast.kind === "error" ? "bg-red-600" : "bg-[#ff4b00]"
      }`}
    >
      {toast.message}
    </div>
  )
}