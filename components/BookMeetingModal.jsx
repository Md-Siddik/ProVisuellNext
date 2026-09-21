"use client"

import { useEffect, useState } from "react"
import { getLocale } from "@/lib/i18n/locale"
import { CalendarClock, CheckCircle2, X } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"

const MEET_LINK = process.env.NEXT_PUBLIC_MEET_LINK || ""

function todayISODate() {
  return new Date().toISOString().slice(0, 10)
}

function formatSlotTime(iso) {
  return new Date(iso).toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" })
}

export default function BookMeetingModal({ onClose }) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [date, setDate] = useState(todayISODate())
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [topic, setTopic] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadingSlots(true)
    setSelectedSlot(null)
    api
      .get(`/appointments/availability?date=${date}`)
      .then((data) => {
        if (!cancelled) setSlots(data.slots)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false)
      })
    return () => {
      cancelled = true
    }
  }, [date])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    if (!selectedSlot) {
      setError(t("bookMeetingModal.selectSlotError"))
      return
    }

    setSaving(true)
    try {
      await api.post("/appointments/request", {
        title: topic
          ? t("bookMeetingModal.meetingTitleWithTopic", { topic })
          : t("bookMeetingModal.meetingTitleFallback", { name: profile?.name || profile?.email }),
        start: selectedSlot.start,
        end: selectedSlot.end,
        notes: topic,
      })
      setDone(true)
    } catch (err) {
      setError(err.message)
      // The slot might have just been taken by someone else — refresh the list.
      if ((err.rawMessage || err.message).includes("nettopp booket")) {
        const data = await api.get(`/appointments/availability?date=${date}`).catch(() => null)
        if (data) setSlots(data.slots)
        setSelectedSlot(null)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-[16px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] rounded-[16px] border border-white/10 bg-[#111212] p-[24px] text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div className="text-center">
            <div className="mx-auto flex h-[56px] w-[56px] items-center justify-center rounded-full border-2 border-emerald-500/40 text-emerald-400">
              <CheckCircle2 size={26} />
            </div>
            <h2 className="mt-[16px] text-[19px] font-[800] text-white">{t("bookMeetingModal.bookedTitle")}</h2>
            <p className="mt-[8px] text-[13.5px] leading-[1.5] text-white/60">
              {t("bookMeetingModal.bookedMessage")}
            </p>
            {MEET_LINK && (
              <a
                href={MEET_LINK}
                target="_blank"
                rel="noreferrer"
                className="mt-[14px] inline-block break-all text-[13px] font-[700] text-[#ff4b00] hover:underline"
              >
                {MEET_LINK}
              </a>
            )}
            <button
              onClick={onClose}
              className="mt-[20px] w-full rounded-[10px] bg-[#ff4b00] py-[11px] text-[13px] font-[800] uppercase tracking-[0.02em] text-white hover:brightness-110"
            >
              {t("bookMeetingModal.close")}
            </button>
          </div>
        ) : (
          <>
            <div className="mb-[18px] flex items-center justify-between">
              <div className="flex items-center gap-[10px]">
                <CalendarClock size={18} className="text-[#ff4b00]" />
                <h2 className="text-[18px] font-[800] text-white">{t("bookMeetingModal.title")}</h2>
              </div>
              <button onClick={onClose} className="text-white/50 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <p className="mb-[16px] text-[13px] leading-[1.5] text-white/55">
              {t("bookMeetingModal.subtitle")}
            </p>

            <div className="mb-[16px] rounded-[10px] border border-white/10 bg-white/[0.03] px-[14px] py-[10px] text-[13px] text-white/70">
              {t("bookMeetingModal.bookingAs")} <span className="font-[700] text-white">{profile?.name || profile?.email}</span>
            </div>

            {error && <p className="mb-[14px] rounded-[8px] bg-red-500/10 px-[12px] py-[8px] text-[13px] text-red-300">{error}</p>}

            <form onSubmit={handleSubmit} className="space-y-[14px]">
              <div>
                <label className="mb-[6px] block text-[12px] font-[600] text-white/70">{t("bookMeetingModal.dateLabel")}</label>
                <input
                  type="date"
                  required
                  min={todayISODate()}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[12px] py-[9px] text-[13px] text-white outline-none focus:border-[#ff4b00]"
                />
              </div>

              <div>
                <label className="mb-[6px] block text-[12px] font-[600] text-white/70">{t("bookMeetingModal.availableSlotsLabel")}</label>
                {loadingSlots ? (
                  <p className="py-[12px] text-center text-[12.5px] text-white/40">{t("bookMeetingModal.checkingSlots")}</p>
                ) : slots.every((s) => !s.available) ? (
                  <p className="py-[12px] text-center text-[12.5px] text-white/40">{t("bookMeetingModal.noSlotsAvailable")}</p>
                ) : (
                  <div className="grid grid-cols-4 gap-[8px]">
                    {slots.map((slot) => {
                      const isSelected = selectedSlot?.start === slot.start
                      return (
                        <button
                          key={slot.start}
                          type="button"
                          disabled={!slot.available}
                          onClick={() => setSelectedSlot(slot)}
                          className={`rounded-[7px] border py-[8px] text-[12px] font-[700] transition-colors ${
                            isSelected
                              ? "border-[#ff4b00] bg-[#ff4b00] text-white"
                              : slot.available
                                ? "border-white/15 bg-white/[0.03] text-white/85 hover:border-[#ff4b00]/60"
                                : "cursor-not-allowed border-white/5 bg-white/[0.01] text-white/20 line-through"
                          }`}
                        >
                          {formatSlotTime(slot.start)}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-[6px] block text-[12px] font-[600] text-white/70">{t("bookMeetingModal.topicLabel")}</label>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={t("bookMeetingModal.topicPlaceholder")}
                  className="w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[12px] py-[9px] text-[13px] text-white outline-none focus:border-[#ff4b00]"
                />
              </div>
              <button
                type="submit"
                disabled={saving || !selectedSlot}
                className="w-full rounded-[10px] bg-[#ff4b00] py-[11px] text-[13px] font-[800] uppercase tracking-[0.02em] text-white hover:brightness-110 disabled:opacity-50"
              >
                {saving
                  ? t("bookMeetingModal.booking")
                  : selectedSlot
                    ? t("bookMeetingModal.bookAtTime", { time: formatSlotTime(selectedSlot.start) })
                    : t("bookMeetingModal.selectATime")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}