"use client"

import { useState } from "react"
import { useTranslation } from "@/lib/i18n"
import EditableText from "../dashboard/editor/EditableText"
import { useEditorMode } from "../dashboard/editor/EditorModeContext"
import { useCmsCollection } from "../dashboard/editor/useCmsCollection"
import CmsItemToolbar from "../dashboard/editor/CmsItemToolbar"
import CmsItemEditor from "../dashboard/editor/CmsItemEditor"
import AddCmsItemButton from "../dashboard/editor/AddCmsItemButton"

const FIELDS = [
  { key: "title", label: "editor.fieldTitle", type: "text" },
  { key: "description", label: "editor.fieldShortDescriptionOptional", type: "textarea" },
]

export default function Portfolio() {
  const { t } = useTranslation()
  const { enabled } = useEditorMode()
  const { items, addItem, updateItem, deleteItem, reorder } = useCmsCollection("portfolioItems")
  const [editingItem, setEditingItem] = useState(null)
  const [editAnchor, setEditAnchor] = useState(null)
  const anchorRef = { current: editAnchor }

  const openEditor = (item, e) => {
    setEditAnchor(e.currentTarget)
    setEditingItem(item)
  }

  // Public reads are already published-only (filtered server-side); admin
  // reads include hidden items too, dimmed in the preview.
  const visibleItems = items

  const move = (index, dir) => {
    const next = [...visibleItems]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    reorder(next.map((i) => i._id))
  }

  return (
    <section id="work" className="bg-paper py-20 sm:py-24">
      <div className="page-shell">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-[750px]">
            <p className="eyebrow text-orange"><EditableText k="portfolio.eyebrow" /></p>
            <h2 className="display-title mt-3 text-[30px] sm:text-[58px]"><EditableText k="portfolio.title" /></h2>
            <p className="mt-5 max-w-[620px] text-sm leading-7 text-neutral-700">
              <EditableText k="portfolio.description" />
            </p>
          </div>
          <a href="#contact" className="outline-button border-black/[0.45] text-black lg:mb-1">
            <EditableText k="portfolio.ctaButton" />
          </a>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleItems.map((item, index) => {
            const CardTag = item.link ? "a" : "div"
            return (
              <div key={item._id} className={`group relative ${enabled && !item.published ? "opacity-40" : ""}`}>
                <CardTag
                  {...(item.link ? { href: item.link } : {})}
                  className="portfolio-card group relative block h-[300px] overflow-hidden bg-black lg:h-[380px]"
                >
                  <img
                    src={item.image}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                  />
                  <div className="pointer-events-none absolute bottom-5 left-5 z-10 max-w-[85%] sm:left-6">
                    <h3 className="font-display text-xl font-bold uppercase tracking-[0.02em] text-white">{item.title}</h3>
                    {item.description && <p className="mt-1 text-[13px] leading-snug text-white/80">{item.description}</p>}
                  </div>
                </CardTag>
                {enabled && (
                  <CmsItemToolbar
                    published={item.published}
                    onEdit={(e) => openEditor(item, e)}
                    onDelete={() => confirm(t("common.confirmDeleteItem", { name: item.title })) && deleteItem(item._id)}
                    onTogglePublish={() => updateItem(item._id, { published: !item.published })}
                    onMoveUp={() => move(index, -1)}
                    onMoveDown={() => move(index, 1)}
                    canMoveUp={index > 0}
                    canMoveDown={index < visibleItems.length - 1}
                  />
                )}
              </div>
            )
          })}
        </div>

        {enabled && (
          <div className="mt-6">
            <AddCmsItemButton label={t("editor.addItemButton")} onClick={(e) => openEditor({}, e)} />
          </div>
        )}
      </div>

      <CmsItemEditor
        key={editingItem?._id || (editingItem ? "new" : "closed")}
        anchorRef={anchorRef}
        open={editingItem !== null}
        fieldsConfig={FIELDS}
        hasLink
        item={editingItem?._id ? editingItem : null}
        addItem={addItem}
        updateItem={updateItem}
        onClose={() => setEditingItem(null)}
      />
    </section>
  )
}