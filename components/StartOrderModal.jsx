"use client"

import { useEffect, useState } from "react"
import { CalendarClock, Mail, MessageSquare, X } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import BookMeetingModal from "./BookMeetingModal"
import EmailComposeModal from "./EmailComposeModal"
import LoginRequiredModal from "./LoginRequiredModal"
import { useTranslation } from "@/lib/i18n"

export const OPEN_ORDER_EVENT = "provisuell:open-start-order"
export const OPEN_CHAT_EVENT = "provisuell:open-chat"

// Mounted once (in MarketingSite). Any button anywhere on the site can
// trigger it with: window.dispatchEvent(new Event(OPEN_ORDER_EVENT))
export default function StartOrderModal() {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuth()
  const [open, setOpen] = useState(false)
  const [showBooking, setShowBooking] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [showLoginRequired, setShowLoginRequired] = useState(false)

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener(OPEN_ORDER_EVENT, handler)
    return () => window.removeEventListener(OPEN_ORDER_EVENT, handler)
  }, [])

  const openChat = () => {
    setOpen(false)
    window.dispatchEvent(new Event(OPEN_CHAT_EVENT))
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-[16px]" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-[520px] rounded-[18px] border border-white/10 bg-[#111212] p-[26px] text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-[6px] flex items-center justify-between">
              <h2 className="text-[22px] font-[800] tracking-[-0.02em] text-white">{t("startOrderModal.title")}</h2>
              <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <p className="mb-[22px] text-[13.5px] leading-[1.5] text-white/55">
              {t("startOrderModal.subtitle")}
            </p>

            <div className="space-y-[12px]">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  if (isAuthenticated) setShowBooking(true)
                  else setShowLoginRequired(true)
                }}
                className="group flex w-full items-center gap-[16px] rounded-[14px] border border-white/10 bg-white/[0.03] p-[18px] text-left transition-colors hover:border-[#ff4b00]/60 hover:bg-[#ff4b00]/[0.06]"
              >
                <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-[#ff4b00]/15 text-[#ff4b00]">
                  <CalendarClock size={22} />
                </span>
                <span className="flex-1">
                  <span className="block text-[15px] font-[700] text-white">{t("startOrderModal.bookMeetingTitle")}</span>
                  <span className="mt-[2px] block text-[12.5px] text-white/50">
                    {t("startOrderModal.bookMeetingDescription")}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={openChat}
                className="group flex w-full items-center gap-[16px] rounded-[14px] border border-white/10 bg-white/[0.03] p-[18px] text-left transition-colors hover:border-[#ff4b00]/60 hover:bg-[#ff4b00]/[0.06]"
              >
                <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-[#ff4b00]/15 text-[#ff4b00]">
                  <MessageSquare size={22} />
                </span>
                <span className="flex-1">
                  <span className="block text-[15px] font-[700] text-white">{t("startOrderModal.chatTitle")}</span>
                  <span className="mt-[2px] block text-[12.5px] text-white/50">
                    {t("startOrderModal.chatDescription")}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setShowEmail(true)
                }}
                className="group flex w-full items-center gap-[16px] rounded-[14px] border border-white/10 bg-white/[0.03] p-[18px] text-left transition-colors hover:border-[#ff4b00]/60 hover:bg-[#ff4b00]/[0.06]"
              >
                <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full bg-[#ff4b00]/15 text-[#ff4b00]">
                  <Mail size={22} />
                </span>
                <span className="flex-1">
                  <span className="block text-[15px] font-[700] text-white">{t("startOrderModal.emailTitle")}</span>
                  <span className="mt-[2px] block text-[12.5px] text-white/50">{t("startOrderModal.emailDescription")}</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showBooking && <BookMeetingModal onClose={() => setShowBooking(false)} />}
      {showEmail && <EmailComposeModal onClose={() => setShowEmail(false)} />}
      {showLoginRequired && (
        <LoginRequiredModal
          title={t("startOrderModal.loginRequiredTitle")}
          message={t("startOrderModal.loginRequiredMessage")}
          onClose={() => setShowLoginRequired(false)}
        />
      )}
    </>
  )
}