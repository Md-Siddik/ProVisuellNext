"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslation } from "@/lib/i18n"
import { useEditorMode } from "./EditorModeContext"
import AnchoredPopover from "./AnchoredPopover"

// Drop-in replacement for `{t("some.key")}` — outside the Website Editor
// (no EditorModeProvider present) this renders the exact same text with
// zero extra markup beyond a whitespace-preserving wrapper, so the public
// site is unaffected. Inside the editor, double-clicking opens a floating
// popover anchored beside the clicked text.
export default function EditableText({ k }) {
  const { t } = useTranslation()
  const { enabled, saveText } = useEditorMode()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const anchorRef = useRef(null)
  const textareaRef = useRef(null)

  const value = t(k)

  // `pre-line` preserves manual newlines the admin typed (Enter in the
  // editor's textarea) while still collapsing ordinary whitespace — so a
  // single-line value renders identically to before.
  if (!enabled) {
    return <span style={{ whiteSpace: "pre-line" }}>{value}</span>
  }

  useEffect(() => {
    if (!editing) return
    const raf = requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.select()
    })
    return () => cancelAnimationFrame(raf)
  }, [editing])

  const startEdit = () => {
    setDraft(value)
    setEditing(true)
  }

  const cancel = () => setEditing(false)

  const save = async () => {
    if (!draft.trim()) return
    setSaving(true)
    try {
      await saveText(k, draft)
      setEditing(false)
    } catch {
      // failed save — popover stays open with the draft, nothing published,
      // so the live page never shows a half-saved value
    } finally {
      setSaving(false)
    }
  }

  const rows = Math.min(10, Math.max(2, draft.split("\n").length + 1))

  return (
    <>
      <span
        ref={anchorRef}
        // A lot of editable text lives inside <a>/<Link> elements (nav
        // items, footer links, CTA buttons) — without this, the click that
        // opens the popover would also trigger that link's navigation.
        onClick={(e) => e.preventDefault()}
        onDoubleClick={(e) => {
          e.preventDefault()
          startEdit()
        }}
        className="pv-editable"
        style={{ whiteSpace: "pre-line" }}
        title={t("editor.doubleClickEdit")}
      >
        {value}
      </span>

      <AnchoredPopover anchorRef={anchorRef} open={editing} onClose={cancel} width={320} height={190}>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Plain Enter inserts a newline (default textarea behavior) —
            // it must NOT trigger save, so a heading can hold a real
            // manual line break the way the admin typed it.
            if (e.key === "Escape") cancel()
          }}
          rows={rows}
          className="pv-popover-textarea"
        />
        <div className="pv-popover-actions">
          <button type="button" onClick={cancel} disabled={saving} className="pv-popover-cancel">
            {t("editor.cancel")}
          </button>
          <button type="button" onClick={save} disabled={saving} className="pv-popover-save">
            {saving ? t("editor.saving") : t("editor.save")}
          </button>
        </div>
      </AnchoredPopover>
    </>
  )
}