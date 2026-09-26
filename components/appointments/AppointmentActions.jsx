"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, CalendarClock, X } from "lucide-react"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { useTimeFormat } from "@/context/TimeFormatContext"
import { BUSINESS_TIMEZONE, getNorwayNow, osloParts } from "@/lib/appointments/time"
import AvailabilitySlotGrid from "./AvailabilitySlotGrid"
import TimeFormatToggle from "./TimeFormatToggle"

const input =
  "w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[12px] py-[9px] text-[13px] text-white outline-none focus:border-[#ff4b00]"

function Shell({ title, onClose, children, labelledBy }) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-[16px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="max-h-[calc(100dvh-32px)] w-full max-w-[480px] overflow-y-auto rounded-[16px] border border-white/10 bg-[#111212] p-[22px] text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-[14px] flex items-center justify-between gap-[10px]">
          <h2 id={labelledBy} className="flex items-center gap-[9px] text-[17px] font-[800]">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label={t("appointmentActions.close")} className="text-white/50 hover:text-white">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Pick a new date + slot and move the appointment (same appointment — no
// duplicate). `staff`: may use slots the booking rules close (still never a
// booked or past one); the server applies the same distinction.
export function RescheduleDialog({ appointment, staff = false, onClose, onDone }) {
  const { t } = useTranslation()
  const { formatInstantDateTime } = useTimeFormat()
  const [today] = useState(() => getNorwayNow().date)
  const [date, setDate] = useState(() => {
    const current = osloParts(appointment.start).date
    return current >= today ? current : today
  })
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [time, setTime] = useState(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setSlots([])
    setTime(null)
    setLoading(true)
    api
      .get(`/appointments/availability?date=${date}&exclude=${appointment._id}`)
      .then((d) => {
        if (cancelled) return
        const staffOpen = ["outside_schedule", "admin_disabled"]
        setSlots(d.slots.map((s) => (staff && !s.available && staffOpen.includes(s.reason) ? { ...s, available: true } : s)))
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [date, appointment._id, staff])

  const save = async () => {
    if (!time) return
    setSaving(true)
    setError("")
    try {
      const { appointment: updated } = await api.post(`/appointments/${appointment._id}/reschedule`, { date, time })
      onDone(updated)
    } catch (err) {
      setError(err.code === "SLOT_UNAVAILABLE" ? t("bookMeetingModal.slotTaken") : err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Shell
      labelledBy="reschedule-title"
      onClose={onClose}
      title={
        <>
          <CalendarClock size={17} className="text-[#ff4b00]" /> {t("appointmentActions.rescheduleTitle")}
        </>
      }
    >
      <p className="mb-[14px] text-[12.5px] text-white/55">
        {t("appointmentActions.currentTime")}: <span className="font-[700] tabular-nums text-white/85">{formatInstantDateTime(appointment.start)}</span>
      </p>
      {error && <p className="mb-[12px] rounded-[8px] bg-red-500/10 px-[12px] py-[8px] text-[13px] text-red-300">{error}</p>}
      <label htmlFor="reschedule-date" className="mb-[6px] block text-[12px] font-[600] text-white/70">
        {t("bookMeetingModal.dateLabel")}
      </label>
      <input id="reschedule-date" type="date" min={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={input} />
      <div className="mb-[6px] mt-[14px] flex flex-wrap items-center justify-between gap-[8px]">
        <span className="text-[12px] font-[600] text-white/70">{t("bookMeetingModal.availableSlotsLabel")}</span>
        <TimeFormatToggle />
      </div>
      <p className="mb-[8px] text-[11.5px] text-white/40">{t("bookMeetingModal.timezoneNote", { zone: BUSINESS_TIMEZONE })}</p>
      {loading ? (
        <p className="py-[12px] text-center text-[12.5px] text-white/40">{t("bookMeetingModal.checkingSlots")}</p>
      ) : slots.some((s) => s.available) ? (
        <AvailabilitySlotGrid slots={slots} selectedTime={time} onSelect={setTime} />
      ) : (
        <p className="py-[12px] text-center text-[12.5px] text-white/40">{t("bookMeetingModal.noSlotsAvailable")}</p>
      )}
      <div className="mt-[16px] flex justify-end gap-[8px]">
        <button type="button" onClick={onClose} className="rounded-[8px] border border-white/15 px-[14px] py-[9px] text-[12.5px] font-[700] text-white/75 hover:bg-white/[0.06]">
          {t("appointmentActions.keep")}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!time || saving}
          className="rounded-[8px] bg-[#ff4b00] px-[16px] py-[9px] text-[12.5px] font-[800] text-white hover:brightness-110 disabled:opacity-50"
        >
          {saving ? t("appointmentActions.saving") : t("appointmentActions.confirmReschedule")}
        </button>
      </div>
    </Shell>
  )
}

// Confirmation before cancelling.
export function CancelDialog({ appointment, onClose, onDone }) {
  const { t } = useTranslation()
  const { formatInstantDateTime } = useTimeFormat()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const confirm = async () => {
    setSaving(true)
    setError("")
    try {
      const { appointment: updated } = await api.patch(`/appointments/${appointment._id}/cancel`)
      onDone(updated)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Shell
      labelledBy="cancel-title"
      onClose={onClose}
      title={
        <>
          <AlertTriangle size={17} className="text-red-300" /> {t("appointmentActions.cancelTitle")}
        </>
      }
    >
      <p className="text-[13px] leading-[1.55] text-white/65">
        {t("appointmentActions.cancelBody", { title: appointment.title, when: formatInstantDateTime(appointment.start) })}
      </p>
      {error && <p className="mt-[12px] rounded-[8px] bg-red-500/10 px-[12px] py-[8px] text-[13px] text-red-300">{error}</p>}
      <div className="mt-[18px] flex justify-end gap-[8px]">
        <button type="button" onClick={onClose} autoFocus className="rounded-[8px] border border-white/15 px-[14px] py-[9px] text-[12.5px] font-[700] text-white/75 hover:bg-white/[0.06]">
          {t("appointmentActions.keep")}
        </button>
        <button type="button" onClick={confirm} disabled={saving} className="rounded-[8px] bg-red-600 px-[16px] py-[9px] text-[12.5px] font-[800] text-white hover:bg-red-500 disabled:opacity-50">
          {saving ? t("appointmentActions.saving") : t("appointmentActions.confirmCancel")}
        </button>
      </div>
    </Shell>
  )
}
