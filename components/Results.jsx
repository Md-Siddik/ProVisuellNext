"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslation } from "@/lib/i18n"
import EditableText from "../dashboard/editor/EditableText"
import { useEditorMode } from "../dashboard/editor/EditorModeContext"
import { useCmsCollection } from "../dashboard/editor/useCmsCollection"
import CmsItemToolbar from "../dashboard/editor/CmsItemToolbar"
import CmsItemEditor from "../dashboard/editor/CmsItemEditor"
import AddCmsItemButton from "../dashboard/editor/AddCmsItemButton"

const PROJECT_FIELDS = [
  { key: "title", label: "editor.fieldProjectTitle", type: "text" },
  { key: "category", label: "editor.fieldCategory", type: "text" },
  { key: "description", label: "editor.fieldShortDescriptionOptional", type: "textarea" },
]

const ArrowRightIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className="h-[27px] w-[27px]"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5 12H19M19 12L14 7M19 12L14 17"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const ChevronLeftIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className="h-[28px] w-[28px]"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M15 18L9 12L15 6"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const ChevronRightIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    className="h-[28px] w-[28px]"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M9 18L15 12L9 6"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const SmileIcon = () => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    className="h-[44px] w-[44px]"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="24"
      cy="24"
      r="18"
      stroke="currentColor"
      strokeWidth="2.5"
    />
    <circle cx="18" cy="20" r="1.8" fill="currentColor" />
    <circle cx="30" cy="20" r="1.8" fill="currentColor" />
    <path
      d="M16 28C18.2 31.8 20.8 33.5 24 33.5C27.2 33.5 29.8 31.8 32 28"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
)

const ProjectsIcon = () => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    className="h-[46px] w-[46px]"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="6"
      y="7"
      width="15"
      height="14"
      rx="1"
      stroke="currentColor"
      strokeWidth="2.5"
    />
    <rect
      x="27"
      y="7"
      width="15"
      height="10"
      rx="1"
      stroke="currentColor"
      strokeWidth="2.5"
    />
    <rect
      x="6"
      y="27"
      width="10"
      height="14"
      rx="1"
      stroke="currentColor"
      strokeWidth="2.5"
    />
    <rect
      x="22"
      y="23"
      width="20"
      height="18"
      rx="1"
      stroke="currentColor"
      strokeWidth="2.5"
    />
    <path
      d="M11 14H16M32 12H37M11 34H13M28 29H36M28 35H36"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </svg>
)

const CalendarIcon = () => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    className="h-[47px] w-[47px]"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="6"
      y="11"
      width="36"
      height="31"
      rx="2"
      stroke="currentColor"
      strokeWidth="2.5"
    />
    <path
      d="M6 19H42M15 6V14M33 6V14"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <circle cx="15" cy="27" r="1.7" fill="currentColor" />
    <circle cx="24" cy="27" r="1.7" fill="currentColor" />
    <circle cx="33" cy="27" r="1.7" fill="currentColor" />
    <circle cx="15" cy="35" r="1.7" fill="currentColor" />
    <circle cx="24" cy="35" r="1.7" fill="currentColor" />
    <circle cx="33" cy="35" r="1.7" fill="currentColor" />
  </svg>
)

const MapPinIcon = () => (
  <svg
    viewBox="0 0 48 48"
    fill="none"
    className="h-[47px] w-[47px]"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M24 43C24 43 37 30.6 37 18.5C37 11.6 31.2 6 24 6C16.8 6 11 11.6 11 18.5C11 30.6 24 43 24 43Z"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <circle
      cx="24"
      cy="18.5"
      r="5.2"
      stroke="currentColor"
      strokeWidth="2.5"
    />
  </svg>
)

const ProjectCard = ({ item, enabled, onEdit, onDelete, onTogglePublish, onMoveUp, onMoveDown, canMoveUp, canMoveDown }) => {
  const CardTag = item.link ? "a" : "div"
  return (
    <article
      data-project-card
      className={`group relative h-[255px] min-w-[calc((100%-36px)/3)] overflow-hidden rounded-[4px] border border-white/[0.08] bg-[#151515] max-md:h-[245px] max-md:min-w-[88%] ${
        enabled && !item.published ? "opacity-40" : ""
      }`}
    >
      <CardTag {...(item.link ? { href: item.link } : {})} className="block h-full w-full">
        <img
          src={item.image}
          alt={`${item.title} / ${item.category}`}
          draggable="false"
          className="h-full w-full select-none object-cover transition-transform duration-500 group-hover:scale-[1.035]"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 flex h-[44px] items-center bg-black/70 px-[20px] backdrop-blur-[2px]">
          <p className="whitespace-nowrap text-[14px] font-[800] uppercase tracking-[0.01em] text-white xl:text-[15px] max-lg:text-[12px] max-md:text-[13px]">
            {item.title} {item.category && <>/ {item.category}</>}
          </p>
        </div>
      </CardTag>

      {enabled && (
        <CmsItemToolbar
          published={item.published}
          onEdit={onEdit}
          onDelete={onDelete}
          onTogglePublish={onTogglePublish}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
        />
      )}
    </article>
  )
}

const StatItem = ({ icon, value, label, border = true, edge }) => (
  <div
    className={`flex min-h-[118px] items-center ${
      edge === "first" ? "pl-0 pr-[48px]" : edge === "last" ? "pl-[48px] pr-0" : "px-[48px]"
    } ${border ? "border-r border-white/25" : ""}`}
  >
    <div className="flex flex-col items-start">
      <div className="mb-[6px] text-[#ff4b00]">{icon}</div>

      <h3 className="whitespace-nowrap text-[39px] font-[800] leading-[0.95] tracking-[-0.025em] text-white xl:text-[42px]">
        {value}
      </h3>

      <p className="mt-[5px] whitespace-nowrap text-[15px] font-[600] leading-[1.1] text-white">
        {label}
      </p>
    </div>
  </div>
)

const Result = () => {
  const { t } = useTranslation()
  const { enabled } = useEditorMode()
  const { items, addItem, updateItem, deleteItem, reorder } = useCmsCollection("featuredProjects")
  const [editingItem, setEditingItem] = useState(null)
  const [editAnchor, setEditAnchor] = useState(null)
  const editAnchorRef = { current: editAnchor }
  const openEditor = (item, e) => {
    setEditAnchor(e.currentTarget)
    setEditingItem(item)
  }
  const desktopSliderRef = useRef(null)
  const mobileSliderRef = useRef(null)
  const [isPaused, setIsPaused] = useState(false)
  const resumeTimeoutRef = useRef(null)

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

  const cardHandlers = (item, index) => ({
    item,
    enabled,
    onEdit: (e) => openEditor(item, e),
    onDelete: () => confirm(t("common.confirmDeleteItem", { name: item.title })) && deleteItem(item._id),
    onTogglePublish: () => updateItem(item._id, { published: !item.published }),
    onMoveUp: () => move(index, -1),
    onMoveDown: () => move(index, 1),
    canMoveUp: index > 0,
    canMoveDown: index < visibleItems.length - 1,
  })

  // Native-scroll slider with a manual wrap-around: a normal step scrolls
  // smoothly by one card; once at either end, the NEXT step jumps back to
  // the opposite end instantly (no visible smooth-scroll traversal across
  // the whole list) so the slider feels infinite instead of getting stuck.
  const scrollSlider = (ref, direction) => {
    const slider = ref.current
    if (!slider) return
    const card = slider.querySelector("[data-project-card]")
    if (!card) return
    const gap = 18
    const distance = card.offsetWidth + gap
    const maxScroll = slider.scrollWidth - slider.clientWidth

    if (direction === "right") {
      if (slider.scrollLeft >= maxScroll - 4) slider.scrollTo({ left: 0, behavior: "auto" })
      else slider.scrollBy({ left: distance, behavior: "smooth" })
    } else {
      if (slider.scrollLeft <= 4) slider.scrollTo({ left: maxScroll, behavior: "auto" })
      else slider.scrollBy({ left: -distance, behavior: "smooth" })
    }
  }

  const handleManualScroll = (ref, direction) => {
    scrollSlider(ref, direction)
    setIsPaused(true)
    clearTimeout(resumeTimeoutRef.current)
    resumeTimeoutRef.current = setTimeout(() => setIsPaused(false), 3000)
  }

  // Auto-play — advances both sliders together every few seconds, paused
  // while the visitor's mouse is anywhere over the section (and briefly
  // after any manual arrow click) so it never fights user interaction.
  useEffect(() => {
    if (isPaused || visibleItems.length < 2) return
    const interval = setInterval(() => {
      scrollSlider(desktopSliderRef, "right")
      scrollSlider(mobileSliderRef, "right")
    }, 4500)
    return () => clearInterval(interval)
  }, [isPaused, visibleItems.length])

  useEffect(() => () => clearTimeout(resumeTimeoutRef.current), [])

  return (
    <section
      id="projects"
      className="w-full overflow-hidden bg-[#101111] font-sans text-white"
    >
      <div className="hidden w-full bg-[#0b0c0c] py-[28px] md:block">
        <div className="mx-auto flex min-h-[294px] w-full max-w-[1760px]">
          <div className="flex w-[34.5%] flex-col justify-center pl-[18px] pr-[45px] sm:pl-[22px] md:pl-[28px] lg:pl-[32px] xl:pl-[40px]">
            <p className="mb-[12px] text-[14px] font-[800] uppercase leading-none tracking-[0.02em] text-[#ff4b00]">
              <EditableText k="results.eyebrow" />
            </p>

            <h2 className="text-[44px] font-[800] leading-[1.02] tracking-[-0.03em] text-white xl:text-[46px]">
              <EditableText k="results.title" />
            </h2>

            <p className="mt-[17px] max-w-[385px] text-[16px] font-[400] leading-[1.42] text-[#eeeeee]">
              <EditableText k="results.description" />
            </p>

            <a
              href="#all-projects"
              className="mt-[21px] inline-flex w-fit items-center gap-[17px] text-[14px] font-[800] uppercase tracking-[0.01em] text-white transition-colors duration-200 hover:text-[#ff4b00]"
            >
              <span><EditableText k="results.seeAllProjects" /></span>
              <ArrowRightIcon />
            </a>
          </div>

          <div className="relative flex w-[65.5%] items-center py-[18px] pr-[100px]">
            <button
              type="button"
              aria-label={t("results.prevProjectAria")}
              onClick={() => handleManualScroll(desktopSliderRef, "left")}
              className="absolute left-[-25px] top-1/2 z-30 flex h-[51px] w-[51px] -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#111111] shadow-[0_5px_18px_rgba(0,0,0,0.35)] transition duration-200 hover:scale-105 active:scale-95"
            >
              <ChevronLeftIcon />
            </button>

            <div
              ref={desktopSliderRef}
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              className="flex w-full snap-x snap-mandatory gap-[18px] overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {visibleItems.map((project, index) => (
                <div
                  key={project._id}
                  className="contents"
                >
                  <ProjectCard {...cardHandlers(project, index)} />
                </div>
              ))}
            </div>

            <button
              type="button"
              aria-label={t("results.nextProjectAria")}
              onClick={() => handleManualScroll(desktopSliderRef, "right")}
              className="absolute right-[73px] top-1/2 z-30 flex h-[51px] w-[51px] -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-white text-[#111111] shadow-[0_5px_18px_rgba(0,0,0,0.35)] transition duration-200 hover:scale-105 active:scale-95"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      </div>

      <div className="hidden w-full border-t border-white/[0.04] bg-gradient-to-r from-[#181818] via-[#242424] to-[#181818] md:block">
        <div className="mx-auto grid min-h-[158px] w-full max-w-[1760px] grid-cols-4 px-[18px] py-[28px] sm:px-[22px] md:px-[28px] lg:px-[32px] xl:px-[40px]">
          <StatItem
            icon={<SmileIcon />}
            value={<EditableText k="results.statCustomersValue" />}
            label={<EditableText k="results.statCustomersLabel" />}
            edge="first"
          />

          <StatItem
            icon={<ProjectsIcon />}
            value={<EditableText k="results.statProjectsValue" />}
            label={<EditableText k="results.statProjectsLabel" />}
          />

          <StatItem
            icon={<CalendarIcon />}
            value={<EditableText k="results.statExperienceValue" />}
            label={<EditableText k="results.statExperienceLabel" />}
          />

          <StatItem
            icon={<MapPinIcon />}
            value={<EditableText k="results.statNationwideValue" />}
            label={<EditableText k="results.statNationwideLabel" />}
            border={false}
            edge="last"
          />
        </div>
      </div>

      <div className="w-full bg-[#111111] px-[20px] py-[35px] md:hidden">
        <p className="mb-[10px] text-[12px] font-[800] uppercase tracking-[0.03em] text-[#ff4b00]">
          <EditableText k="results.eyebrow" />
        </p>

        <h2 className="text-[36px] font-[800] leading-[1.03] tracking-[-0.03em] text-white">
          <EditableText k="results.title" />
        </h2>

        <p className="mt-[15px] max-w-[390px] text-[14px] leading-[1.5] text-white/80">
          <EditableText k="results.description" />
        </p>

        <a
          href="#all-projects"
          className="mt-[18px] inline-flex items-center gap-[12px] text-[13px] font-[800] uppercase text-white"
        >
          <span><EditableText k="results.seeAllProjects" /></span>
          <ArrowRightIcon />
        </a>

        <div className="relative mt-[28px]">
          <button
            type="button"
            aria-label={t("results.prevProjectAria")}
            onClick={() => handleManualScroll(mobileSliderRef, "left")}
            className="absolute left-[-8px] top-1/2 z-30 flex h-[44px] w-[44px] -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg active:scale-95"
          >
            <ChevronLeftIcon />
          </button>

          <div
            ref={mobileSliderRef}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
            className="flex snap-x snap-mandatory gap-[18px] overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {visibleItems.map((project, index) => (
              <ProjectCard key={`mobile-${project._id}`} {...cardHandlers(project, index)} />
            ))}
          </div>

          <button
            type="button"
            aria-label={t("results.nextProjectAria")}
            onClick={() => handleManualScroll(mobileSliderRef, "right")}
            className="absolute right-[-8px] top-1/2 z-30 flex h-[44px] w-[44px] -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg active:scale-95"
          >
            <ChevronRightIcon />
          </button>
        </div>

        <div className="mt-[34px] grid grid-cols-2 border-t border-white/20">
          <div className="border-b border-r border-white/20 py-[25px] pr-[15px]">
            <div className="text-[#ff4b00]">
              <SmileIcon />
            </div>

            <h3 className="mt-[8px] text-[34px] font-[800] leading-none text-white">
              <EditableText k="results.statCustomersValue" />
            </h3>

            <p className="mt-[5px] text-[13px] font-[600] text-white">
              <EditableText k="results.statCustomersLabel" />
            </p>
          </div>

          <div className="border-b border-white/20 py-[25px] pl-[20px]">
            <div className="text-[#ff4b00]">
              <ProjectsIcon />
            </div>

            <h3 className="mt-[8px] text-[34px] font-[800] leading-none text-white">
              <EditableText k="results.statProjectsValue" />
            </h3>

            <p className="mt-[5px] text-[13px] font-[600] text-white">
              <EditableText k="results.statProjectsLabel" />
            </p>
          </div>

          <div className="border-r border-white/20 py-[25px] pr-[15px]">
            <div className="text-[#ff4b00]">
              <CalendarIcon />
            </div>

            <h3 className="mt-[8px] text-[34px] font-[800] leading-none text-white">
              <EditableText k="results.statExperienceValue" />
            </h3>

            <p className="mt-[5px] text-[13px] font-[600] text-white">
              <EditableText k="results.statExperienceLabel" />
            </p>
          </div>

          <div className="py-[25px] pl-[20px]">
            <div className="text-[#ff4b00]">
              <MapPinIcon />
            </div>

            <h3 className="mt-[8px] break-words text-[27px] font-[800] leading-none text-white">
              <EditableText k="results.statNationwideValue" />
            </h3>

            <p className="mt-[5px] text-[13px] font-[600] leading-[1.2] text-white">
              <EditableText k="results.statNationwideLabel" />
            </p>
          </div>
        </div>
      </div>

      {enabled && (
        <div className="px-[20px] py-[20px] sm:px-[22px] md:px-[28px] lg:px-[32px] xl:px-[40px]">
          <AddCmsItemButton label={t("editor.addProjectButton")} onClick={(e) => openEditor({}, e)} />
        </div>
      )}

      <CmsItemEditor
        key={editingItem?._id || (editingItem ? "new" : "closed")}
        anchorRef={editAnchorRef}
        open={editingItem !== null}
        fieldsConfig={PROJECT_FIELDS}
        hasLink
        item={editingItem?._id ? editingItem : null}
        addItem={addItem}
        updateItem={updateItem}
        onClose={() => setEditingItem(null)}
      />
    </section>
  )
}

export default Result