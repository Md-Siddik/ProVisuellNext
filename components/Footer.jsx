"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useTranslation } from "@/lib/i18n"
import { useCookieConsent } from "@/context/CookieConsentContext"
import EditableText from "../dashboard/editor/EditableText"
import EditableImage from "../dashboard/editor/EditableImage"
import { useEditorMode } from "../dashboard/editor/EditorModeContext"
import { useCmsCollection } from "../dashboard/editor/useCmsCollection"
import CmsItemToolbar from "../dashboard/editor/CmsItemToolbar"
import CmsItemEditor from "../dashboard/editor/CmsItemEditor"
import { SocialIcon, SOCIAL_ICON_OPTIONS } from "./SocialIcons"

const SOCIAL_FIELDS = [{ key: "platform", label: "editor.fieldPlatform", type: "text" }]

const PinIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="h-[18px] w-[18px]"
  >
    <path
      d="M12 21C12 21 18.5 15.3 18.5 9.7C18.5 6.05 15.6 3 12 3C8.4 3 5.5 6.05 5.5 9.7C5.5 15.3 12 21 12 21Z"
      stroke="currentColor"
      strokeWidth="1.7"
    />

    <circle
      cx="12"
      cy="9.5"
      r="2.4"
      stroke="currentColor"
      strokeWidth="1.7"
    />
  </svg>
)

const MailIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="h-[18px] w-[18px]"
  >
    <rect
      x="3"
      y="5"
      width="18"
      height="14"
      rx="2"
      stroke="currentColor"
      strokeWidth="1.7"
    />

    <path
      d="M4 7L12 13L20 7"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const PhoneIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="h-[18px] w-[18px]"
  >
    <path
      d="M7.2 3.5L10 8.1L8.15 9.75C9.1 11.75 10.65 13.35 12.7 14.3L14.35 12.45L19 15.25L18.1 19C17.85 20 16.95 20.65 15.95 20.5C9.1 19.55 4.45 14.85 3.5 8.05C3.35 7 4 6.15 5 5.9L7.2 3.5Z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const MAP_ZOOM = 2.3
const LENS_SIZE = 130

const NORWAY_MAP_FALLBACK = "/assets/norway-map-trimmed.png"

const NorwayMap = () => {
  const { t, getMedia } = useTranslation()
  const mapSrc = getMedia("footer.mapImage", NORWAY_MAP_FALLBACK)
  const containerRef = useRef(null)
  const [lens, setLens] = useState(null)

  const updateLens = (e) => {
    const rect = containerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top))

    setLens({
      left: x - LENS_SIZE / 2,
      top: y - LENS_SIZE / 2,
      bgWidth: rect.width * MAP_ZOOM,
      bgHeight: rect.height * MAP_ZOOM,
      bgX: -(x * MAP_ZOOM - LENS_SIZE / 2),
      bgY: -(y * MAP_ZOOM - LENS_SIZE / 2),
    })
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={updateLens}
      onMouseEnter={updateLens}
      onMouseLeave={() => setLens(null)}
      className="group relative h-[230px] w-[200px] cursor-crosshair max-lg:h-[190px] max-lg:w-[165px]"
    >
      <EditableImage
        k="footer.mapImage"
        fallbackSrc={NORWAY_MAP_FALLBACK}
        alt={t("footer.mapAlt")}
        loading="lazy"
        decoding="async"
        draggable="false"
        className="norway-map-anim pointer-events-none h-full w-full select-none object-contain transition-transform duration-500 group-hover:scale-[1.05]"
      />

      {lens && (
        <div
          className="pointer-events-none absolute rounded-full border-2 border-[#ff4b00] bg-[#111212] shadow-[0_0_30px_rgba(255,75,11,0.6)]"
          style={{
            left: lens.left,
            top: lens.top,
            width: LENS_SIZE,
            height: LENS_SIZE,
            backgroundImage: `url(${mapSrc})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${lens.bgWidth}px ${lens.bgHeight}px`,
            backgroundPosition: `${lens.bgX}px ${lens.bgY}px`,
          }}
        />
      )}
    </div>
  )
}

const Footer = () => {
  const { t } = useTranslation()
  const { openSettings: openCookieSettings } = useCookieConsent()
  const { enabled } = useEditorMode()
  const { items: socialLinks, addItem, updateItem, deleteItem, reorder } = useCmsCollection("socialLinks")
  const [editingSocial, setEditingSocial] = useState(null)
  const [socialAnchor, setSocialAnchor] = useState(null)
  const socialAnchorRef = { current: socialAnchor }

  const openSocialEditor = (item, e) => {
    setSocialAnchor(e.currentTarget)
    setEditingSocial(item)
  }

  const moveSocial = (index, dir) => {
    const next = [...socialLinks]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    reorder(next.map((i) => i._id))
  }
  return (
    <footer
      id="contact"
      className="w-full bg-[#111212] text-white"
    >
      <div className="mx-auto w-full max-w-[1760px] px-[18px] sm:px-[22px] md:px-[28px] lg:px-[32px] xl:px-[40px]">
        <div className="grid min-h-[160px] grid-cols-[2.25fr_1.05fr_1.05fr_1.15fr_1.35fr_0.9fr] items-center gap-[35px] py-[36px] max-xl:grid-cols-[2fr_1fr_1fr_1fr_1.3fr_0.8fr] max-lg:grid-cols-3 max-lg:gap-y-[35px] max-md:grid-cols-2 max-md:items-start max-md:gap-x-[22px] max-md:gap-y-[30px] max-md:py-[34px]">
          <div className="max-md:col-span-2 max-md:border-b max-md:border-white/[0.08] max-md:pb-[24px]">
            <div className="notranslate flex items-center" translate="no">
              <span className="text-[29px] font-[800] leading-none tracking-[-0.035em] text-[#ff4b00]">
                Pro
              </span>

              <span className="text-[29px] font-[800] leading-none tracking-[-0.035em] text-white">
                Visuell
              </span>
            </div>

            <p className="mt-[5px] text-[10px] font-[700] uppercase tracking-[0.11em] text-[#c9c9c9]">
              <EditableText k="footer.tagline" />
            </p>

            <p className="mt-[8px] max-w-[315px] text-[13px] font-[400] leading-[1.35] text-[#d1d1d1]">
              <EditableText k="footer.description" />
            </p>

            <div className="mt-[13px] flex flex-wrap items-center gap-[23px] text-[#e6e6e6]">
              {socialLinks.map((item, index) => (
                <span
                  key={item._id}
                  className={`group relative inline-flex ${enabled && !item.published ? "opacity-40" : ""}`}
                  onDoubleClick={enabled ? (e) => openSocialEditor(item, e) : undefined}
                  title={enabled ? t("editor.doubleClickEdit") : item.platform}
                >
                  <a
                    href={item.link || "#"}
                    aria-label={item.platform}
                    onClick={enabled ? (e) => e.preventDefault() : undefined}
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center transition-colors duration-200 hover:text-[#ff4b00]"
                  >
                    <SocialIcon platform={item.platform} icon={item.image} />
                  </a>
                  {enabled && (
                    <CmsItemToolbar
                      orientation="horizontal"
                      published={item.published}
                      onEdit={(e) => openSocialEditor(item, e)}
                      onDelete={() => confirm(t("common.confirmDeleteItem", { name: item.platform })) && deleteItem(item._id)}
                      onTogglePublish={() => updateItem(item._id, { published: !item.published })}
                      onMoveUp={() => moveSocial(index, -1)}
                      onMoveDown={() => moveSocial(index, 1)}
                      canMoveUp={index > 0}
                      canMoveDown={index < socialLinks.length - 1}
                      className="pv-cms-toolbar-inline"
                    />
                  )}
                </span>
              ))}
              {enabled && (
                <button
                  type="button"
                  onClick={(e) => openSocialEditor({}, e)}
                  className="flex h-[24px] w-[24px] items-center justify-center rounded-[6px] border border-dashed border-[#ff4b00]/60 text-[#ff4b00] hover:bg-[#ff4b00]/10"
                  title={t("editor.addSocialLink")}
                >
                  +
                </button>
              )}
            </div>

            <CmsItemEditor
              key={editingSocial?._id || (editingSocial ? "new" : "closed")}
              anchorRef={socialAnchorRef}
              open={editingSocial !== null}
              fieldsConfig={SOCIAL_FIELDS}
              hasLink
              iconOptions={SOCIAL_ICON_OPTIONS}
              item={editingSocial?._id ? editingSocial : null}
              addItem={addItem}
              updateItem={updateItem}
              onClose={() => setEditingSocial(null)}
            />
          </div>

          <div>
            <h3 className="mb-[12px] text-[12px] font-[800] uppercase tracking-[0.025em] text-white">
              <EditableText k="footer.services" />
            </h3>

            <ul className="space-y-[6px] text-[13px] leading-[1.2] text-[#d5d5d5]">
              <li>
                <a
                  href="#brandify"
                  className="notranslate transition-colors hover:text-[#ff4b00]"
                  translate="no"
                >
                  Brandify
                </a>
              </li>

              <li>
                <a
                  href="#packaging"
                  className="notranslate transition-colors hover:text-[#ff4b00]"
                  translate="no"
                >
                  Packaging
                </a>
              </li>

              <li>
                <a
                  href="#vehicle-protection"
                  className="notranslate transition-colors hover:text-[#ff4b00]"
                  translate="no"
                >
                  Vehicle Protection
                </a>
              </li>

              <li>
                <a
                  href="#vehicle-protection"
                  className="transition-colors hover:text-[#ff4b00]"
                >
                  <EditableText k="footer.windowTintPpf" />
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-[12px] text-[12px] font-[800] uppercase tracking-[0.025em] text-white">
              <EditableText k="footer.aboutUs" />
            </h3>

            <ul className="space-y-[6px] text-[13px] leading-[1.2] text-[#d5d5d5]">
              <li>
                <a
                  href="#about"
                  className="transition-colors hover:text-[#ff4b00]"
                >
                  <EditableText k="footer.aboutText" />
                </a>
              </li>

              <li>
                <a
                  href="#process"
                  className="transition-colors hover:text-[#ff4b00]"
                >
                  <EditableText k="footer.ourProcess" />
                </a>
              </li>

              <li>
                <a
                  href="#quality"
                  className="transition-colors hover:text-[#ff4b00]"
                >
                  <EditableText k="footer.qualityEnvironment" />
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-[12px] text-[12px] font-[800] uppercase tracking-[0.025em] text-white">
              <EditableText k="footer.customerService" />
            </h3>

            <ul className="space-y-[6px] text-[13px] leading-[1.2] text-[#d5d5d5]">
              <li>
                <a
                  href="#faq"
                  className="transition-colors hover:text-[#ff4b00]"
                >
                  <EditableText k="footer.faq" />
                </a>
              </li>

              <li>
                <a
                  href="#maintenance"
                  className="transition-colors hover:text-[#ff4b00]"
                >
                  <EditableText k="footer.maintenanceTips" />
                </a>
              </li>

              <li>
                <a
                  href="#contact"
                  className="transition-colors hover:text-[#ff4b00]"
                >
                  <EditableText k="footer.contactUs" />
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-[12px] text-[12px] font-[800] uppercase tracking-[0.025em] text-white">
              <EditableText k="footer.contact" />
            </h3>

            <div className="space-y-[7px] text-[13px] text-[#d5d5d5]">
              <a
                href="#"
                className="flex items-center gap-[10px] transition-colors hover:text-[#ff4b00]"
              >
                <PinIcon />
                <span><EditableText k="footer.address" /></span>
              </a>

              <a
                href={`mailto:${t("footer.email").trim()}`}
                className="flex items-center gap-[10px] transition-colors hover:text-[#ff4b00]"
              >
                <MailIcon />
                <span><EditableText k="footer.email" /></span>
              </a>

              <a
                href={`tel:${t("footer.phone").replace(/[^\d+]/g, "")}`}
                className="flex items-center gap-[10px] transition-colors hover:text-[#ff4b00]"
              >
                <PhoneIcon />
                <span><EditableText k="footer.phone" /></span>
              </a>
            </div>
          </div>

          <div className="flex items-center justify-end max-lg:justify-start max-md:col-span-2 max-md:justify-center max-md:border-t max-md:border-white/[0.08] max-md:pt-[26px]">
            <NorwayMap />
          </div>
        </div>

        <div className="flex min-h-[29px] items-center justify-between border-t border-white/[0.08] py-[18px] text-[12px] text-[#a9a9a9] max-md:flex-col max-md:gap-[12px] max-md:py-[15px]">
          {/* Year and company are shared by every language; only the
              "All rights reserved" sentence is translated. */}
          <p>
            © <EditableText k="footer.copyrightYear" /> <EditableText k="footer.companyName" />. <EditableText k="footer.rightsReserved" />
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-[25px] gap-y-[10px]">
            <a
              href="#privacy"
              className="transition-colors hover:text-white"
            >
              <EditableText k="footer.privacy" />
            </a>

            <span className="h-[17px] w-px bg-white/35" />

            <a
              href="#terms"
              className="transition-colors hover:text-white"
            >
              <EditableText k="footer.terms" />
            </a>

            <span className="h-[17px] w-px bg-white/35" />

            {/* Cookie texts come from the translations, not the Website
                Editor — they describe what the site actually stores. */}
            <Link href="/cookies" className="transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-[#ff4b00]">
              {t("cookies.policyLink")}
            </Link>

            <span className="h-[17px] w-px bg-white/35" />

            <button type="button" onClick={openCookieSettings} className="transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-[#ff4b00]">
              {t("cookies.settingsLink")}
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer