"use client"

import Link from "next/link"
import { Lock } from "lucide-react"
import { useTranslation } from "@/lib/i18n"

// `from` (optional) is where to return after logging in; without it the modal behaves as before.
export default function LoginRequiredModal({ onClose, title, message, from }) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-[16px]" onClick={onClose}>
      <div
        className="w-full max-w-[400px] rounded-[16px] border border-white/10 bg-[#111212] p-[26px] text-center text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#ff4b00]/15 text-[#ff4b00]">
          <Lock size={24} />
        </div>
        <h2 className="mt-[16px] text-[18px] font-[800] text-white">{title || t("loginRequiredModal.defaultTitle")}</h2>
        <p className="mt-[8px] text-[13.5px] leading-[1.5] text-white/55">
          {message || t("loginRequiredModal.defaultMessage")}
        </p>
        <div className="mt-[20px] flex gap-[10px]">
          <Link
            href={from ? `/login?from=${encodeURIComponent(from)}` : "/login"}
            className="flex-1 rounded-[10px] bg-[#ff4b00] py-[11px] text-[13px] font-[800] uppercase tracking-[0.02em] text-white hover:brightness-110"
          >
            {t("loginRequiredModal.loginButton")}
          </Link>
          <Link
            href="/signup"
            className="flex-1 rounded-[10px] border border-white/15 py-[11px] text-[13px] font-[700] text-white hover:bg-white/[0.06]"
          >
            {t("loginRequiredModal.signupButton")}
          </Link>
        </div>
        <button onClick={onClose} className="mt-[14px] text-[12px] text-white/40 hover:text-white/70">
          {t("loginRequiredModal.cancel")}
        </button>
      </div>
    </div>
  )
}