"use client"

import { useState } from "react"
import { useTranslation } from "@/lib/i18n"
import EditableText from "../dashboard/editor/EditableText"
import EditableVideo from "../dashboard/editor/EditableVideo"
import { useEditorMode } from "../dashboard/editor/EditorModeContext"
import { useCmsCollection } from "../dashboard/editor/useCmsCollection"
import CmsItemToolbar from "../dashboard/editor/CmsItemToolbar"
import CmsItemEditor from "../dashboard/editor/CmsItemEditor"

const HERO_SERVICE_FIELDS = [{ key: "name", label: "editor.fieldServiceName", type: "text" }]

const ArrowIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className="h-[16px] w-[16px]"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5 12H19M19 12L14.5 7.5M19 12L14.5 16.5"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const ChevronDown = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className="h-[24px] w-[24px]"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6 9L12 15L18 9"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const HeroLink = ({ href, children }) => {
  return (
    <a
      href={href}
      className="group inline-flex min-w-[158px] items-center justify-between border-b border-white/55 pb-[8px] text-[12px] font-[700] uppercase tracking-[0.025em] text-white transition-all duration-300 hover:border-[#ff4b00] hover:text-[#ff4b00]"
    >
      <span>{children}</span>

      <span className="ml-[18px] transition-transform duration-300 group-hover:translate-x-[4px]">
        <ArrowIcon />
      </span>
    </a>
  )
}

const Hero = () => {
  const { t } = useTranslation()
  const { enabled } = useEditorMode()
  const { items: services, addItem, updateItem, deleteItem, reorder } = useCmsCollection("heroServices")
  const [editingItem, setEditingItem] = useState(null)
  const [editAnchor, setEditAnchor] = useState(null)
  const anchorRef = { current: editAnchor }

  const openEditor = (item, e) => {
    setEditAnchor(e.currentTarget)
    setEditingItem(item)
  }

  const move = (index, dir) => {
    const next = [...services]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    reorder(next.map((i) => i._id))
  }

  return (
    <section
      id="home"
      className="relative min-h-[620px] w-full overflow-hidden bg-black sm:min-h-[680px] lg:h-screen lg:min-h-[680px] lg:max-h-[960px]"
    >
      <div className="absolute inset-0">
        <EditableVideo
          k="hero.video"
          fallbackSrc="/videos/ProVisuell_Hero_Video.mp4"
          // Painted instantly while the video loads (served as WebP).
          poster="/assets/hero-poster.png"
          className="h-full w-full object-cover"
        />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-black/[0.08]" />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/65 via-black/20 to-transparent" />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-[160px] bg-gradient-to-b from-black/55 to-transparent" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[150px] bg-gradient-to-t from-black/40 to-transparent" />

      <div className="relative z-20 flex h-full min-h-[620px] w-full items-center px-[18px] pt-[65px] sm:min-h-[680px] sm:px-[22px] md:px-[28px] lg:min-h-[680px] lg:px-[32px] lg:pt-[55px] xl:px-[40px]">
        <div className="w-full max-w-[760px]">
          <div className="mb-[14px] flex flex-wrap items-center gap-x-[6px] text-[11px] font-[700] uppercase tracking-[0.13em] text-[#ff4b00] md:text-[12px]">
            {services.map((service, index) => (
              <span
                key={service._id}
                className={`group relative inline-flex items-center gap-[6px] ${enabled && !service.published ? "opacity-40" : ""}`}
                onDoubleClick={enabled ? (e) => openEditor(service, e) : undefined}
                title={enabled ? t("editor.doubleClickEdit") : undefined}
              >
                {index > 0 && <span aria-hidden="true">•</span>}
                {service.name}
                {enabled && (
                  <CmsItemToolbar
                    orientation="horizontal"
                    published={service.published}
                    onEdit={(e) => openEditor(service, e)}
                    onDelete={() => confirm(t("common.confirmDeleteItem", { name: service.name })) && deleteItem(service._id)}
                    onTogglePublish={() => updateItem(service._id, { published: !service.published })}
                    onMoveUp={() => move(index, -1)}
                    onMoveDown={() => move(index, 1)}
                    canMoveUp={index > 0}
                    canMoveDown={index < services.length - 1}
                    className="pv-cms-toolbar-inline"
                  />
                )}
              </span>
            ))}
            {enabled && (
              <button type="button" onClick={(e) => openEditor({}, e)} className="pv-add-inline-btn" title={t("editor.addServiceTitle")}>
                {t("editor.addInline")}
              </button>
            )}
          </div>

          <h1 className="max-w-[640px] text-[26px] font-[800] uppercase leading-[1.14] tracking-[-0.015em] text-white sm:max-w-[760px] sm:text-[36px] sm:leading-[1.08] sm:tracking-[-0.025em] md:text-[40px] lg:text-[42px] xl:text-[44px]">
            <EditableText k="hero.title" />
          </h1>

          <p className="mt-[17px] max-w-[520px] text-[14px] font-[400] leading-[1.6] text-white/85 md:text-[15px] lg:text-[16px]">
            <EditableText k="hero.subtitle" />
          </p>

          <div className="mt-[28px] flex flex-wrap items-center gap-[18px] max-sm:flex-col max-sm:items-start max-sm:gap-[20px]">
            <div className="flex items-center gap-[29px] max-sm:flex-col max-sm:items-start max-sm:gap-[20px]">
              <HeroLink href="#brandify">
                <EditableText k="hero.exploreBrandifyCta" />
              </HeroLink>

              <HeroLink href="#packaging">
                <EditableText k="hero.explorePackagingCta" />
              </HeroLink>
            </div>
          </div>
        </div>
      </div>

      <a
        href="#intro"
        aria-label={t("hero.scrollAriaLabel")}
        className="absolute bottom-[20px] left-1/2 z-30 flex -translate-x-1/2 flex-col items-center text-white/90 transition-colors duration-300 hover:text-white max-md:bottom-[17px]"
      >
        <div className="flex h-[50px] w-[50px] items-center justify-center rounded-full border border-white/60 backdrop-blur-[2px] transition-all duration-300 hover:border-white hover:bg-white/10 md:h-[54px] md:w-[54px]">
          <ChevronDown />
        </div>

        <span className="mt-[6px] text-[10px] font-[600] tracking-[0.015em] text-white/80">
          <EditableText k="hero.exploreMore" />
        </span>
      </a>

      <CmsItemEditor
        key={editingItem?._id || (editingItem ? "new" : "closed")}
        anchorRef={anchorRef}
        open={editingItem !== null}
        fieldsConfig={HERO_SERVICE_FIELDS}
        item={editingItem?._id ? editingItem : null}
        addItem={addItem}
        updateItem={updateItem}
        onClose={() => setEditingItem(null)}
      />
    </section>
  )
}

export default Hero