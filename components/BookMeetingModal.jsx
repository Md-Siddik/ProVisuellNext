"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarClock, CheckCircle2, X } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useTimeFormat } from "@/context/TimeFormatContext"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/locale"
import { BUSINESS_TIMEZONE, SLOT_INTERVAL_MINUTES, formatDateString, getNorwayNow } from "@/lib/appointments/time"
import TimeFormatToggle from "./appointments/TimeFormatToggle"
import AvailabilitySlotGrid from "./appointments/AvailabilitySlotGrid"

const MEET_LINK = process.env.NEXT_PUBLIC_MEET_LINK || ""

export default function BookMeetingModal({ onClose }) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { formatTime } = useTimeFormat()
  // "Today" is Norway's date, not the visitor's — availability follows Oslo.
  const [today] = useState(() => getNorwayNow().date)
  const [date, setDate] = useState(today)
  const [slots, setSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(true)
  const [slotsError, setSlotsError] = useState(false)
  const [reload, setReload] = useState(0)
  // The normalized "HH:MM" — stays the same when switching 12h/24h.
  const [selectedTime, setSelectedTime] = useState(null)
  const [topic, setTopic] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [booked, setBooked] = useState(null)

  useEffect(() => {
    let cancelled = false
    // Never show the previous date's slots while the new ones load.
    setSlots([])
    setLoadingSlots(true)
    setSlotsError(false)
    setSelectedTime(null)
    api
      .get(`/appointments/availability?date=${date}`)
      .then((data) => {
        if (!cancelled) setSlots(data.slots || [])
      })
      .catch(() => {
        if (!cancelled) setSlotsError(true)
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false)
      })
    return () => {
      cancelled = true
    }
  }, [date, reload])

  const refreshSlots = useCallback(() => setReload((n) => n + 1), [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    if (!selectedTime) {
      setError(t("bookMeetingModal.selectSlotError"))
      return
    }

    setSaving(true)
    try {
      await api.post("/appointments/request", {
        title: topic
          ? t("bookMeetingModal.meetingTitleWithTopic", { topic })
          : t("bookMeetingModal.meetingTitleFallback", { name: profile?.name || profile?.email }),
        date,
        time: selectedTime,
        durationMinutes: SLOT_INTERVAL_MINUTES,
        notes: topic,
      })
      setBooked({ date, time: selectedTime })
    } catch (err) {
      if (err.code === "SLOT_UNAVAILABLE") {
        // Someone else got there first (or the time just passed) — reload the day.
        setError(t("bookMeetingModal.slotTaken"))
        refreshSlots()
      } else {
        setError(err.message)
      }
    } finally {
      setSaving(false)
    }
  }

  const hasBookable = slots.some((s) => s.available)

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-[16px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-meeting-title"
        className="max-h-[calc(100dvh-32px)] w-full max-w-[480px] overflow-y-auto rounded-[16px] border border-white/10 bg-[#111212] p-[24px] text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {booked ? (
          <div className="text-center">
            <div className="mx-auto flex h-[56px] w-[56px] items-center justify-center rounded-full border-2 border-emerald-500/40 text-emerald-400">
              <CheckCircle2 size={26} />
            </div>
            <h2 id="book-meeting-title" className="mt-[16px] text-[19px] font-[800] text-white">
              {t("bookMeetingModal.bookedTitle")}
            </h2>
            <div className="mt-[14px] rounded-[10px] border border-white/10 bg-white/[0.03] px-[14px] py-[12px] text-left text-[13px]">
              <p className="text-white/50">{t("bookMeetingModal.bookedFor")}</p>
              <p className="mt-[4px] font-[700] text-white">{formatDateString(booked.date, getLocale(), { dateStyle: "long" })}</p>
              <p className="font-[700] tabular-nums text-white">{formatTime(booked.time)}</p>
              <p className="mt-[2px] text-[12px] text-white/45">{BUSINESS_TIMEZONE}</p>
            </div>
            <div className="mt-[12px] flex justify-center">
              <TimeFormatToggle />
            </div>
            <p className="mt-[12px] text-[13.5px] leading-[1.5] text-white/60">{t("bookMeetingModal.bookedMessage")}</p>
            {MEET_LINK && (
              <a href={MEET_LINK} target="_blank" rel="noreferrer" className="mt-[14px] inline-block break-all text-[13px] font-[700] text-[#ff4b00] hover:underline">
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
                <h2 id="book-meeting-title" className="text-[18px] font-[800] text-white">
                  {t("bookMeetingModal.title")}
                </h2>
              </div>
              <button onClick={onClose} aria-label={t("bookMeetingModal.close")} className="text-white/50 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <p className="mb-[16px] text-[13px] leading-[1.5] text-white/55">{t("bookMeetingModal.subtitle")}</p>

            <div className="mb-[16px] rounded-[10px] border border-white/10 bg-white/[0.03] px-[14px] py-[10px] text-[13px] text-white/70">
              {t("bookMeetingModal.bookingAs")} <span className="font-[700] text-white">{profile?.name || profile?.email}</span>
            </div>

            {error && <p className="mb-[14px] rounded-[8px] bg-red-500/10 px-[12px] py-[8px] text-[13px] text-red-300">{error}</p>}

            <form onSubmit={handleSubmit} className="space-y-[14px]">
              <div>
                <label htmlFor="book-meeting-date" className="mb-[6px] block text-[12px] font-[600] text-white/70">
                  {t("bookMeetingModal.dateLabel")}
                </label>
                <input
                  id="book-meeting-date"
                  type="date"
                  required
                  min={today}
                  value={date}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                  className="w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[12px] py-[9px] text-[13px] text-white outline-none focus:border-[#ff4b00]"
                />
              </div>

              <div>
                <div className="mb-[6px] flex flex-wrap items-center justify-between gap-[8px]">
                  <span className="text-[12px] font-[600] text-white/70">{t("bookMeetingModal.availableSlotsLabel")}</span>
                  <TimeFormatToggle />
                </div>
                <p className="mb-[8px] text-[11.5px] text-white/40">{t("bookMeetingModal.timezoneNote", { zone: BUSINESS_TIMEZONE })}</p>
                {loadingSlots ? (
                  <p role="status" className="py-[12px] text-center text-[12.5px] text-white/40">
                    {t("bookMeetingModal.checkingSlots")}
                  </p>
                ) : slotsError ? (
                  <div className="py-[10px] text-center">
                    <p className="text-[12.5px] text-red-300">{t("bookMeetingModal.slotsLoadFailed")}</p>
                    <button type="button" onClick={refreshSlots} className="mt-[8px] text-[12.5px] font-[700] text-[#ff4b00] hover:underline">
                      {t("bookMeetingModal.retry")}
                    </button>
                  </div>
                ) : !hasBookable ? (
                  <p className="py-[12px] text-center text-[12.5px] text-white/40">{t("bookMeetingModal.noSlotsAvailable")}</p>
                ) : (
                  <AvailabilitySlotGrid slots={slots} selectedTime={selectedTime} onSelect={setSelectedTime} />
                )}
              </div>

              <div>
                <label htmlFor="book-meeting-topic" className="mb-[6px] block text-[12px] font-[600] text-white/70">
                  {t("bookMeetingModal.topicLabel")}
                </label>
                <input
                  id="book-meeting-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={t("bookMeetingModal.topicPlaceholder")}
                  className="w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[12px] py-[9px] text-[13px] text-white outline-none focus:border-[#ff4b00]"
                />
              </div>
              <button
                type="submit"
                disabled={saving || !selectedTime || loadingSlots}
                className="w-full rounded-[10px] bg-[#ff4b00] py-[11px] text-[13px] font-[800] uppercase tracking-[0.02em] text-white hover:brightness-110 disabled:opacity-50"
              >
                {saving
                  ? t("bookMeetingModal.booking")
                  : selectedTime
                    ? t("bookMeetingModal.bookAtTime", { time: formatTime(selectedTime) })
                    : t("bookMeetingModal.selectATime")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
