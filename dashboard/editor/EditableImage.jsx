"use client"

import { useRef, useState } from "react"
import { useTranslation } from "@/lib/i18n"
import { useEditorMode } from "./EditorModeContext"

// Drop-in replacement for a plain <img src="..." /> — outside the editor
// this renders the exact same <img>, sourced from any CMS override so the
// public site always shows the latest saved image. Inside the editor,
// double-clicking opens a file picker and uploads/saves in place.
export default function EditableImage({ k, fallbackSrc, alt = "", className, style, ...imgProps }) {
  const { getMedia, t } = useTranslation()
  const { enabled, saveImage } = useEditorMode()
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef(null)

  const src = getMedia(k, fallbackSrc)

  if (!enabled) return <img src={src} alt={alt} className={className} style={style} {...imgProps} />

  const onFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    setUploading(true)
    try {
      await saveImage(k, file)
    } catch {
      // upload/save failed — nothing was written, image on screen stays as-is
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
      title={t("editor.doubleClickReplaceImage")}
    >
      <img src={src} alt={alt} className={className} style={style} {...imgProps} />
      {uploading && (
        <span className="pv-image-uploading">
          <span className="pv-image-uploading-spinner" />
        </span>
      )}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={onFileChange} />
    </span>
  )
}