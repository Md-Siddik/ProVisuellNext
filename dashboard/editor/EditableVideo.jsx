"use client"

import { useRef, useState } from "react"
import { useTranslation } from "@/lib/i18n"
import { useEditorMode } from "./EditorModeContext"

// Same pattern as EditableImage but for a <video> background — outside the
// editor this renders the plain <video><source .../></video> sourced from
// any CMS override; double-click inside the editor opens a file picker and
// replaces it in place. Videos are shared across every language, same as
// images (no per-language video content).
export default function EditableVideo({ k, fallbackSrc, className, style, poster }) {
  const { getMedia, t } = useTranslation()
  const { enabled, saveVideo } = useEditorMode()
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef(null)

  const src = getMedia(k, fallbackSrc)

  const videoEl = (
    <video autoPlay muted loop playsInline preload="auto" className={className} style={style} poster={poster}>
      <source src={src} type="video/mp4" />
    </video>
  )

  if (!enabled) return videoEl

  const onFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setUploading(true)
    try {
      await saveVideo(k, file)
    } catch {
      // upload/save failed — nothing was written, video on screen stays as-is
    } finally {
      setUploading(false)
    }
  }

  return (
    <span
      className="pv-editable-image"
      onClick={(e) => e.preventDefault()}
      onDoubleClick={(e) => {
        e.preventDefault()
        inputRef.current?.click()
      }}
      title={t("editor.doubleClickReplaceVideo")}
    >
      {videoEl}
      {uploading && (
        <span className="pv-image-uploading">
          <span className="pv-image-uploading-spinner" />
        </span>
      )}
      <input ref={inputRef} type="file" accept="video/*" hidden onChange={onFileChange} />
    </span>
  )
}