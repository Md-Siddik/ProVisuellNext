"use client"

import { Clock } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { useTimeFormat } from "@/context/TimeFormatContext"

// Shown when someone tries to join a meeting before its scheduled start —
// the Meet link only opens once that time has actually arrived.
export default function MeetingTooEarlyModal({ start, onClose }) {
  const { t } = useTranslation()
  const { formatInstantDateTime } = useTimeFormat()
  // Stops the backdrop click from also bubbling up and closing whatever
  // modal this one happens to be nested inside (e.g. the appointment
  // detail modal on the staff calendar).
  const handleBackdropClick = (e) => {
    e.stopPropagation()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-[16px]" onClick={handleBackdropClick}>
      <div
        className="w-full max-w-[400px] rounded-[16px] border border-white/10 bg-[#111212] p-[26px] text-center text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#ff4b00]/15 text-[#ff4b00]">
          <Clock size={24} />
        </div>
        <h2 className="mt-[16px] text-[18px] font-[800] text-white">{t("meetingTooEarlyModal.title")}</h2>
        <p className="mt-[8px] text-[13.5px] leading-[1.5] text-white/55">
          {t("meetingTooEarlyModal.description")} <span className="font-[700] text-white">{formatInstantDateTime(start)}</span> <span className="text-white/40">({t("timeFormat.norwayTime")})</span>
        </p>
        <button
          onClick={onClose}
          className="mt-[20px] w-full rounded-[10px] bg-[#ff4b00] py-[11px] text-[13px] font-[800] uppercase tracking-[0.02em] text-white hover:brightness-110"
        >
          {t("meetingTooEarlyModal.close")}
        </button>
      </div>
    </div>
  )
}