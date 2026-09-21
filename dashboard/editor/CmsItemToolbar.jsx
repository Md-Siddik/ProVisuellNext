"use client"

import { useTranslation } from "@/lib/i18n"
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Eye, EyeOff, Pencil, Trash2 } from "lucide-react"

// Small control strip for one CMS-collection item — Edit / Move / Hide-
// Publish / Delete. Only ever rendered for the item currently hovered or
// selected (the call site handles that), so it's always obvious which
// element a given toolbar belongs to instead of many icons competing for
// attention across the page at once.
export default function CmsItemToolbar({
  published,
  onEdit,
  onDelete,
  onTogglePublish,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  orientation = "vertical", // "vertical" = up/down chevrons, "horizontal" = left/right
  hoverReveal = true, // hidden until the item is hovered/focused — only one toolbar visible at a time
  className = "",
}) {
  const { t } = useTranslation()
  const MovePrev = orientation === "horizontal" ? ChevronLeft : ChevronUp
  const MoveNext = orientation === "horizontal" ? ChevronRight : ChevronDown
  const movePrevLabel = orientation === "horizontal" ? t("editor.moveLeft") : t("editor.moveUp")
  const moveNextLabel = orientation === "horizontal" ? t("editor.moveRight") : t("editor.moveDown")

  return (
    <div
      className={`pv-cms-toolbar ${hoverReveal ? "pv-cms-toolbar-hoverable" : ""} ${className}`}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <button type="button" onClick={onMoveUp} disabled={!canMoveUp} title={movePrevLabel} aria-label={movePrevLabel}>
        <MovePrev size={14} />
      </button>
      <button type="button" onClick={onMoveDown} disabled={!canMoveDown} title={moveNextLabel} aria-label={moveNextLabel}>
        <MoveNext size={14} />
      </button>
      <span className="pv-cms-toolbar-sep" />
      <button type="button" onClick={onTogglePublish} title={published ? t("editor.hideFromPublic") : t("editor.publish")} aria-label={published ? t("editor.hide") : t("editor.publish")}>
        {published ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>
      <button type="button" onClick={onEdit} title={t("editor.edit")} aria-label={t("editor.edit")}>
        <Pencil size={14} />
      </button>
      <span className="pv-cms-toolbar-sep" />
      <button type="button" onClick={onDelete} title={t("editor.delete")} aria-label={t("editor.delete")} className="pv-cms-toolbar-danger">
        <Trash2 size={14} />
      </button>
    </div>
  )
}