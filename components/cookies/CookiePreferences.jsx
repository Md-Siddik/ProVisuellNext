"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { COOKIE_CATEGORIES, OPTIONAL_CATEGORY_KEYS } from "@/lib/cookieConsent/config"
import { panel, primaryBtn, secondaryBtn } from "./ui"
import { useModalFocus } from "./useModalFocus"

function Switch({ checked, onChange, labelledBy, describedBy }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[28px] w-[48px] shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff4b00] ${
        checked ? "bg-[#ff4b00]" : "bg-white/20"
      }`}
    >
      <span className={`inline-block h-[22px] w-[22px] rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[23px]" : "translate-x-[3px]"}`} />
    </button>
  )
}

// The detailed panel: every category with what it's for, whether anything
// uses it today, and a switch for the optional ones.
//   consent     the saved choice (null on a first visit)
//   fromBanner  opened from the first-visit banner (closing returns there)
export default function CookiePreferences({ consent, fromBanner, onSave, onAcceptAll, onOnlyNecessary, onClose }) {
  const { t } = useTranslation()
  const [choice, setChoice] = useState(() => Object.fromEntries(OPTIONAL_CATEGORY_KEYS.map((k) => [k, consent?.[k] === true])))
  const dialog = useRef(null)
  const closeBtn = useRef(null)

  // Focus moves into the panel, stays there, and returns afterwards; Escape closes.
  useModalFocus(dialog, { onEscape: onClose, initialFocus: closeBtn })

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/70 sm:items-center sm:p-[16px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-prefs-title"
        className={`${panel} flex max-h-[92dvh] w-full max-w-[560px] flex-col rounded-t-[18px] sm:max-h-[min(88dvh,760px)] sm:rounded-[18px]`}
      >
        <div className="flex shrink-0 items-start justify-between gap-[12px] border-b border-white/[0.08] px-[20px] pb-[14px] pt-[18px] sm:px-[24px]">
          <div className="min-w-0">
            <h2 id="cookie-prefs-title" className="text-[19px] font-[800] tracking-[-0.01em]">
              {t("cookies.preferencesTitle")}
            </h2>
            <p className="mt-[4px] text-[13px] leading-[1.5] text-white/55">
              {t("cookies.preferencesIntro")}{" "}
              <Link href="/cookies" onClick={onClose} className="font-[700] text-[#ff9b6a] underline-offset-2 hover:underline">
                {t("cookies.policyLink")}
              </Link>
            </p>
          </div>
          <button
            ref={closeBtn}
            type="button"
            onClick={onClose}
            aria-label={fromBanner ? t("cookies.back") : t("cookies.close")}
            className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full text-white/60 hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-[#ff4b00]"
          >
            <X size={18} />
          </button>
        </div>

        <ul className="min-h-0 flex-1 space-y-[10px] overflow-y-auto overscroll-contain px-[20px] py-[16px] sm:px-[24px]">
          {COOKIE_CATEGORIES.map((c) => {
            const titleId = `cookie-cat-${c.key}`
            const descId = `cookie-cat-${c.key}-desc`
            return (
              <li key={c.key} className="rounded-[14px] border border-white/10 bg-white/[0.03] p-[14px]">
                <div className="flex items-start justify-between gap-[14px]">
                  <div className="min-w-0">
                    <h3 id={titleId} className="text-[15px] font-[800]">
                      {t(`cookies.category.${c.key}.title`)}
                    </h3>
                    <p id={descId} className="mt-[3px] text-[12.5px] leading-[1.5] text-white/60">
                      {t(`cookies.category.${c.key}.description`)}
                      {!c.inUse && <span className="mt-[4px] block font-[700] text-white/75">{t(`cookies.category.${c.key}.notInUse`)}</span>}
                    </p>
                  </div>
                  {c.required ? (
                    <span className="shrink-0 rounded-full bg-emerald-500/15 px-[10px] py-[4px] text-[11.5px] font-[800] text-emerald-300">{t("cookies.alwaysActive")}</span>
                  ) : (
                    <Switch checked={choice[c.key]} onChange={(v) => setChoice((prev) => ({ ...prev, [c.key]: v }))} labelledBy={titleId} describedBy={descId} />
                  )}
                </div>
              </li>
            )
          })}
        </ul>

        <div className="grid shrink-0 grid-cols-1 gap-[8px] border-t border-white/[0.08] px-[20px] pb-[max(16px,env(safe-area-inset-bottom))] pt-[14px] sm:grid-cols-3 sm:px-[24px]">
          <button type="button" onClick={() => onSave(choice)} className={`${primaryBtn} sm:order-3`}>
            {t("cookies.savePreferences")}
          </button>
          <button type="button" onClick={onAcceptAll} className={`${secondaryBtn} sm:order-2`}>
            {t("cookies.acceptAll")}
          </button>
          <button type="button" onClick={onOnlyNecessary} className={`${secondaryBtn} sm:order-1`}>
            {t("cookies.onlyNecessary")}
          </button>
        </div>
      </div>
    </div>
  )
}
