"use client"

import { useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Cookie } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { ghostBtn, panel, primaryBtn, secondaryBtn } from "./ui"
import { useModalFocus } from "./useModalFocus"

// First-visit cookie choice: a centered modal that blocks the site until the
// visitor picks one of the three actions (Escape and clicks outside do
// nothing). On the cookie policy page itself it sits at the bottom without
// blocking, so "Read more" can actually be read before choosing.
export default function CookieBanner({ onAcceptAll, onOnlyNecessary, onCustomize }) {
  const { t } = useTranslation()
  const blocking = usePathname() !== "/cookies"
  const dialog = useRef(null)
  const firstAction = useRef(null)
  useModalFocus(dialog, { active: blocking, initialFocus: firstAction })

  return (
    <div
      className={
        blocking
          ? "fixed inset-0 z-[1050] flex items-center justify-center overflow-y-auto bg-black/75 p-[16px] backdrop-blur-[3px]"
          : "pointer-events-none fixed inset-x-0 bottom-0 z-[1050] flex justify-center p-[12px] pb-[max(12px,env(safe-area-inset-bottom))]"
      }
    >
      <section
        ref={dialog}
        tabIndex={-1}
        role={blocking ? "alertdialog" : "dialog"}
        aria-modal={blocking ? "true" : "false"}
        aria-labelledby="cookie-banner-title"
        aria-describedby="cookie-banner-text"
        className={`${panel} pointer-events-auto my-auto w-full max-w-[600px] rounded-[22px] p-[24px] outline-none sm:p-[34px]`}
      >
        <div className="flex items-center gap-[14px]">
          <span className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full bg-[#ff4b00]/15 text-[#ff4b00]" aria-hidden="true">
            <Cookie size={24} />
          </span>
          <h2 id="cookie-banner-title" className="text-[22px] font-[800] tracking-[-0.02em] sm:text-[26px]">
            {t("cookies.bannerTitle")}
          </h2>
        </div>
        <p id="cookie-banner-text" className="mt-[16px] text-[15px] leading-[1.65] text-white/70 sm:text-[16px]">
          {t("cookies.bannerText")}{" "}
          <Link href="/cookies" className="font-[700] text-[#ff9b6a] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-[#ff4b00]">
            {t("cookies.readMore")}
          </Link>
        </p>
        <div className="mt-[24px] grid grid-cols-1 gap-[10px] sm:grid-cols-2">
          <button ref={firstAction} type="button" onClick={onAcceptAll} className={`${primaryBtn} min-h-[50px] text-[15px]`}>
            {t("cookies.acceptAll")}
          </button>
          <button type="button" onClick={onOnlyNecessary} className={`${secondaryBtn} min-h-[50px] text-[15px]`}>
            {t("cookies.onlyNecessary")}
          </button>
        </div>
        <button type="button" onClick={onCustomize} className={`${ghostBtn} mt-[8px] w-full text-[14.5px]`}>
          {t("cookies.customize")}
        </button>
      </section>
    </div>
  )
}
