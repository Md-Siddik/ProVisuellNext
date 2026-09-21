"use client"

import { useEffect, useMemo, useState } from "react"
import { getLocale } from "@/lib/i18n/locale"
import Link from "next/link"
import { useAuth } from "@/context/AuthContext"
import {
  Calendar,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Mail,
  Package,
  Plus,
  Video,
  X,
} from "lucide-react"
import { api } from "@/lib/api"
import MeetingTooEarlyModal from "../../components/MeetingTooEarlyModal"
import { useTranslation } from "@/lib/i18n"

const MEET_LINK = process.env.NEXT_PUBLIC_MEET_LINK || ""

const DAY_LABEL_KEYS = [
  "appointmentsPage.dayMon",
  "appointmentsPage.dayTue",
  "appointmentsPage.dayWed",
  "appointmentsPage.dayThu",
  "appointmentsPage.dayFri",
  "appointmentsPage.daySat",
  "appointmentsPage.daySun",
]
const START_HOUR = 8
// Floor, not a ceiling — the grid always extends at least this far, but
// widens further (see `useEndHour` below) for whatever evening appointments
// actually exist that week. Admins can book a meeting at any time via
// NewMeetingModal's plain time input, so 18:00 was never a real limit.
const MIN_END_HOUR = 18
const ROW_HEIGHT = 84 // px per hour, must match the h-[84px] rows below — tall enough that even a 30-min slot fits a title + time line

// The grid must be tall enough to hold every appointment that week,
// however late it runs — never a fixed cutoff that clips evening bookings.
function useEndHour(appointments) {
  return useMemo(() => {
    let end = MIN_END_HOUR
    for (const appt of appointments) {
      if (appt.status === "cancelled") continue
      const finish = new Date(appt.end)
      if (Number.isNaN(finish.getTime())) continue
      let hour = finish.getHours()
      if (finish.getMinutes() > 0) hour += 1
      if (hour > end) end = hour
    }
    return Math.min(end, 24)
  }, [appointments])
}

// waiting = violet, approved = theme orange, completed = green, rejected = red.
const ORDER_STATUS_STYLE = {
  pending: "border-violet-500/40 text-violet-400",
  approved: "border-[#ff4b00]/50 text-[#ff8a4d]",
  rejected: "border-red-500/40 text-red-400",
  completed: "border-emerald-500/40 text-emerald-400",
}
const ORDER_CHIP_STYLE = {
  pending: "border-violet-500/50 bg-violet-500/[0.12] text-violet-300",
  approved: "border-[#ff4b00]/50 bg-[#ff4b00]/[0.12] text-[#ff9b6a]",
  completed: "border-emerald-500/50 bg-emerald-500/[0.12] text-emerald-300",
  rejected: "border-red-500/50 bg-red-500/[0.12] text-red-300",
}
// For the timed appointment block itself, once its meeting has turned into
// an order: a soft tinted glass panel with a glowing accent border in the
// order's status color, rather than a flat block of color.
const ORDER_BLOCK_STYLE = {
  pending: {
    block: "border border-violet-500/60 bg-violet-500/[0.12] shadow-[0_0_12px_rgba(167,139,250,0.4)]",
    accent: "text-violet-300",
  },
  approved: {
    block: "border border-[#ff4b00]/60 bg-[#ff4b00]/[0.12] shadow-[0_0_12px_rgba(255,75,0,0.4)]",
    accent: "text-[#ff9b6a]",
  },
  completed: {
    block: "border border-emerald-500/60 bg-emerald-500/[0.12] shadow-[0_0_12px_rgba(16,185,129,0.4)]",
    accent: "text-emerald-300",
  },
  rejected: {
    block: "border border-red-500/60 bg-red-500/[0.12] shadow-[0_0_12px_rgba(239,68,68,0.4)]",
    accent: "text-red-300",
  },
}
const ORDER_BLOCK_FALLBACK = { block: "border border-white/20 bg-white/[0.06]", accent: "text-white/60" }

function formatShortDate(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "–"
  return d.toLocaleDateString(getLocale(), { day: "2-digit", month: "2-digit" })
}

function formatFullDate(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "–"
  return d.toLocaleDateString(getLocale(), { day: "2-digit", month: "2-digit", year: "numeric" })
}

// Guards against stale/malformed dates (e.g. an old record with
// expectedDeliveryDate saved as "") rendering as "Invalid Date".
function isValidDate(value) {
  return Boolean(value) && !Number.isNaN(new Date(value).getTime())
}

// Same contextual date as Ordreoversikt — what the date means shifts with
// the order's status.
function orderDateInfo(order, t) {
  if (order.status === "completed") {
    if (isValidDate(order.completedAt)) return { label: t("appointmentsPage.dateCompleted"), value: order.completedAt }
    if (isValidDate(order.expectedDeliveryDate)) return { label: t("appointmentsPage.dateDelivery"), value: order.expectedDeliveryDate }
    return { label: t("appointmentsPage.dateOrdered"), value: order.createdAt }
  }
  if (order.status === "approved" && isValidDate(order.expectedDeliveryDate)) {
    return { label: t("appointmentsPage.dateDelivery"), value: order.expectedDeliveryDate }
  }
  return { label: t("appointmentsPage.dateOrdered"), value: order.createdAt }
}

function startOfWeek(date) {
  const d = new Date(date)
  const day = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDateRange(monday) {
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const fmt = (d) => d.toLocaleDateString(getLocale(), { day: "numeric", month: "short" })
  return `${fmt(monday)} – ${fmt(sunday)}`
}

// scheduled/completed/cancelled is what's persisted — "missed" is derived
// here (a scheduled slot whose end time has passed) rather than stored, so
// it always reflects reality without a background job.
function appointmentDisplayStatus(appt) {
  if (appt.status === "cancelled") return "cancelled"
  if (appt.status === "completed") return "completed"
  if (new Date(appt.end) < new Date()) return "missed"
  return "booked"
}

const APPT_STATUS_LABEL_KEYS = {
  booked: "appointmentsPage.apptStatusBooked",
  missed: "appointmentsPage.apptStatusMissed",
  completed: "appointmentsPage.apptStatusCompleted",
  cancelled: "appointmentsPage.apptStatusCancelled",
}
const APPT_STATUS_BADGE = {
  booked: "border-[#ff4b00]/40 text-[#ff4b00]",
  missed: "border-white/25 text-white/45",
  completed: "border-emerald-500/40 text-emerald-400",
  cancelled: "border-red-500/40 text-red-400",
}

function NewMeetingModal({ weekStart, onClose, onCreated }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState("")
  const [day, setDay] = useState(0)
  const [start, setStart] = useState("09:00")
  const [end, setEnd] = useState("10:00")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    const date = new Date(weekStart)
    date.setDate(date.getDate() + Number(day))
    const [sh, sm] = start.split(":").map(Number)
    const [eh, em] = end.split(":").map(Number)
    const startDate = new Date(date)
    startDate.setHours(sh, sm, 0, 0)
    const endDate = new Date(date)
    endDate.setHours(eh, em, 0, 0)

    if (endDate <= startDate) {
      setError(t("appointmentsPage.errorEndBeforeStart"))
      return
    }

    setSaving(true)
    try {
      const { appointment } = await api.post("/appointments", {
        title,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        notes,
      })
      onCreated(appointment)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-[16px]" onClick={onClose}>
      <div
        className="w-full max-w-[420px] rounded-[16px] border border-white/10 bg-[#111212] p-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-[18px] flex items-center justify-between">
          <h2 className="text-[18px] font-[800] text-white">{t("appointmentsPage.newMeetingTitle")}</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {error && <p className="mb-[14px] rounded-[8px] bg-red-500/10 px-[12px] py-[8px] text-[13px] text-red-300">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-[14px]">
          <div>
            <label className="mb-[6px] block text-[12px] font-[600] text-white/70">{t("appointmentsPage.titleLabel")}</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("appointmentsPage.titlePlaceholder")}
              className="w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[12px] py-[9px] text-[13px] text-white outline-none focus:border-[#ff4b00]"
            />
          </div>
          <div>
            <label className="mb-[6px] block text-[12px] font-[600] text-white/70">{t("appointmentsPage.dayLabel")}</label>
            <select
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[12px] py-[9px] text-[13px] text-white outline-none focus:border-[#ff4b00]"
            >
              {DAY_LABEL_KEYS.map((labelKey, i) => {
                const d = new Date(weekStart)
                d.setDate(d.getDate() + i)
                return (
                  <option key={labelKey} value={i} className="bg-[#111212]">
                    {t(labelKey)} {d.getDate()}.
                  </option>
                )
              })}
            </select>
          </div>
          <div className="flex gap-[12px]">
            <div className="flex-1">
              <label className="mb-[6px] block text-[12px] font-[600] text-white/70">{t("appointmentsPage.fromLabel")}</label>
              <input
                type="time"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[12px] py-[9px] text-[13px] text-white outline-none focus:border-[#ff4b00]"
              />
            </div>
            <div className="flex-1">
              <label className="mb-[6px] block text-[12px] font-[600] text-white/70">{t("appointmentsPage.toLabel")}</label>
              <input
                type="time"
                required
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[12px] py-[9px] text-[13px] text-white outline-none focus:border-[#ff4b00]"
              />
            </div>
          </div>
          <div>
            <label className="mb-[6px] block text-[12px] font-[600] text-white/70">{t("appointmentsPage.notesLabel")}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-[8px] border border-white/15 bg-white/[0.04] px-[12px] py-[9px] text-[13px] text-white outline-none focus:border-[#ff4b00]"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-[8px] bg-[#ff4b00] py-[11px] text-[13px] font-[800] uppercase tracking-[0.02em] text-white hover:brightness-110 disabled:opacity-50"
          >
            {saving ? t("appointmentsPage.saving") : t("appointmentsPage.saveMeetingButton")}
          </button>
        </form>
      </div>
    </div>
  )
}

function AppointmentDetailModal({ appointment, onClose }) {
  const { t } = useTranslation()
  const isPublicRequest = !appointment.createdBy
  const displayStatus = appointmentDisplayStatus(appointment)
  const order = appointment.linkedOrder
  const [tooEarly, setTooEarly] = useState(false)

  const handleJoinClick = (e) => {
    if (new Date(appointment.start) > new Date()) {
      e.preventDefault()
      setTooEarly(true)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-[16px]" onClick={onClose}>
      <div
        className="w-full max-w-[420px] rounded-[16px] border border-white/10 bg-[#111212] p-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-[6px] flex items-start justify-between gap-[12px]">
          <div>
            <span className="mb-[6px] inline-flex items-center gap-[6px] rounded-[5px] border border-white/15 bg-white/[0.04] px-[8px] py-[3px] text-[10px] font-[700] uppercase tracking-[0.03em] text-white/60">
              {order ? (
                <>
                  <Package size={11} /> {t("appointmentsPage.orderBadge")}
                </>
              ) : isPublicRequest ? (
                t("appointmentsPage.customerAppointmentBadge")
              ) : (
                t("appointmentsPage.internalMeetingBadge")
              )}
            </span>
            <h2 className="text-[17px] font-[800] leading-tight text-white">{order ? order.customerName : appointment.title}</h2>
          </div>
          <button onClick={onClose} className="shrink-0 text-white/50 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Once this meeting became an order, the order's status is the
            headline — the meeting itself already served its purpose. */}
        {order ? (
          <span className={`mt-[6px] inline-flex items-center gap-[6px] rounded-[5px] border px-[10px] py-[4px] text-[11px] font-[800] uppercase ${ORDER_STATUS_STYLE[order.status]}`}>
            <Package size={12} />
            {t("appointmentsPage.orderStatusPrefix", { status: t(`status.${order.status}`) })}
          </span>
        ) : (
          <span
            className={`mt-[6px] inline-flex items-center rounded-[5px] border px-[10px] py-[4px] text-[11px] font-[800] uppercase ${APPT_STATUS_BADGE[displayStatus]}`}
          >
            {t(APPT_STATUS_LABEL_KEYS[displayStatus])}
          </span>
        )}

        <div className="mt-[16px] space-y-[10px] text-[13px] text-white/75">
          <p className="flex items-center gap-[10px]">
            <Clock size={15} className="shrink-0 text-white/40" />
            {new Date(appointment.start).toLocaleString(getLocale(), { dateStyle: "full", timeStyle: "short" })} –{" "}
            {new Date(appointment.end).toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="flex items-center gap-[10px]">
            <Mail size={15} className="shrink-0 text-white/40" />
            {appointment.requestedByName} ({appointment.requestedByEmail})
          </p>
          {appointment.notes && <p className="rounded-[8px] bg-white/[0.03] p-[10px] text-white/60">{appointment.notes}</p>}
        </div>

        {order && (
          <div className="mt-[16px] flex items-center justify-between rounded-[10px] border border-white/10 bg-white/[0.03] p-[12px]">
            <div className="flex items-center gap-[10px]">
              <Package size={16} className="text-white/40" />
              <div>
                <p className="text-[12.5px] font-[700] text-white">#{order.orderNumber}</p>
                <p className="text-[11px] text-white/45">{t("appointmentsPage.orderFromMeeting")}</p>
              </div>
            </div>
            {(() => {
              const info = orderDateInfo(order, t)
              return (
                <span className="text-right text-[11px] text-white/50">
                  {info.label}
                  <br />
                  <span className="font-[700] text-white/80">
                    {formatFullDate(info.value)}
                  </span>
                </span>
              )
            })()}
          </div>
        )}

        {displayStatus !== "cancelled" && MEET_LINK && (
          <a
            href={MEET_LINK}
            target="_blank"
            rel="noreferrer"
            onClick={handleJoinClick}
            className="mt-[18px] flex w-full items-center justify-center gap-[8px] rounded-[10px] bg-[#ff4b00] py-[11px] text-[13px] font-[800] uppercase tracking-[0.02em] text-white hover:brightness-110"
          >
            <Video size={15} />
            {t("appointmentsPage.joinMeetingButton")}
          </a>
        )}
      </div>
      {tooEarly && <MeetingTooEarlyModal start={appointment.start} onClose={() => setTooEarly(false)} />}
    </div>
  )
}

function OrderDetailModal({ order, onClose }) {
  const { t } = useTranslation()
  const { role } = useAuth()
  const base = role === "owner" ? "/dashboard/owner" : "/dashboard/admin"
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-[16px]" onClick={onClose}>
      <div
        className="w-full max-w-[420px] rounded-[16px] border border-white/10 bg-[#111212] p-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-[6px] flex items-start justify-between gap-[12px]">
          <div>
            <span className="mb-[6px] inline-flex items-center gap-[6px] rounded-[5px] border border-[#7aa2ff]/40 bg-[#7aa2ff]/[0.08] px-[8px] py-[3px] text-[10px] font-[700] uppercase tracking-[0.03em] text-[#7aa2ff]">
              <Package size={11} /> {t("appointmentsPage.orderBadge")}
            </span>
            <h2 className="text-[17px] font-[800] leading-tight text-white">#{order.orderNumber}</h2>
          </div>
          <button onClick={onClose} className="shrink-0 text-white/50 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <span className={`mt-[6px] inline-flex items-center rounded-[5px] border px-[10px] py-[4px] text-[11px] font-[800] uppercase ${ORDER_STATUS_STYLE[order.status]}`}>
          {t(`status.${order.status}`)}
        </span>

        <div className="mt-[16px] space-y-[8px] text-[13px] text-white/75">
          <p><span className="text-white/45">{t("appointmentsPage.customerFieldLabel")}</span> {order.customerName}</p>
          <p><span className="text-white/45">{t("appointmentsPage.serviceFieldLabel")}</span> {order.service}</p>
          {order.amount > 0 && <p><span className="text-white/45">{t("appointmentsPage.amountFieldLabel")}</span> kr {order.amount.toLocaleString("no-NO")},-</p>}
          {(() => {
            const info = orderDateInfo(order, t)
            return (
              <p>
                <span className="text-white/45">{info.label}:</span>{" "}
                {formatFullDate(info.value)}
              </p>
            )
          })()}
          <p className="rounded-[8px] bg-white/[0.03] p-[10px] text-white/60">{order.specification}</p>
        </div>

        <Link
          href={`${base}/ordreoversikt`}
          className="mt-[18px] flex w-full items-center justify-center gap-[8px] rounded-[10px] border border-white/15 py-[11px] text-[13px] font-[700] text-white hover:bg-white/[0.06]"
        >
          {t("appointmentsPage.openInOrderOverview")}
        </Link>
      </div>
    </div>
  )
}

export default function Ansattmoter() {
  const { t } = useTranslation()
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [appointments, setAppointments] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedAppt, setSelectedAppt] = useState(null)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [error, setError] = useState("")

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    return d
  }, [weekStart])

  const endHour = useEndHour(appointments)
  const HOURS = useMemo(
    () => Array.from({ length: endHour - START_HOUR + 1 }, (_, i) => START_HOUR + i),
    [endHour]
  )

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError("")
      try {
        const [apptData, orderData] = await Promise.all([
          api.get(`/appointments?from=${weekStart.toISOString()}&to=${weekEnd.toISOString()}`),
          api.get(`/orders?deliveryFrom=${weekStart.toISOString()}&deliveryTo=${weekEnd.toISOString()}&limit=100`),
        ])
        if (!cancelled) {
          setAppointments(apptData.appointments)
          setOrders(orderData.orders)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [weekStart, weekEnd])

  const byDay = useMemo(() => {
    const map = Array.from({ length: 7 }, () => [])
    for (const appt of appointments) {
      if (appt.status === "cancelled") continue
      const start = new Date(appt.start)
      const dayIndex = (start.getDay() + 6) % 7
      map[dayIndex].push(appt)
    }
    return map
  }, [appointments])

  const ordersByDay = useMemo(() => {
    const map = Array.from({ length: 7 }, () => [])
    for (const order of orders) {
      // A waiting order usually has no delivery date set yet — show it on
      // the day it was placed instead of dropping it from the calendar
      // until someone sets one.
      const relevantDate = order.expectedDeliveryDate || order.createdAt
      if (!relevantDate) continue
      const d = new Date(relevantDate)
      if (Number.isNaN(d.getTime())) continue
      const dayIndex = (d.getDay() + 6) % 7
      map[dayIndex].push(order)
    }
    return map
  }, [orders])

  const eventStyle = (appt) => {
    const start = new Date(appt.start)
    const end = new Date(appt.end)
    const startMinutes = (start.getHours() - START_HOUR) * 60 + start.getMinutes()
    const durationMinutes = Math.max((end - start) / 60000, 20)
    return {
      top: `${(startMinutes / 60) * ROW_HEIGHT}px`,
      height: `${(durationMinutes / 60) * ROW_HEIGHT - 4}px`,
    }
  }

  return (
    <div>
      <div className="flex flex-col justify-between gap-[14px] sm:flex-row sm:items-start">
        <div>
          <h1 className="text-[26px] font-[800] tracking-[-0.02em] text-white">{t("appointmentsPage.title")}</h1>
          <p className="mt-[4px] text-[14px] text-white/50">
            {t("appointmentsPage.subtitle")}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-[8px] rounded-[10px] bg-[#ff4b00] px-[16px] py-[10px] text-[13px] font-[800] uppercase tracking-[0.02em] text-white hover:brightness-110"
        >
          <Plus size={15} />
          {t("appointmentsPage.newMeetingTitle")}
        </button>
      </div>

      <div className="mt-[14px] flex flex-wrap items-center gap-[18px] text-[12px] text-white/50">
        <span className="flex items-center gap-[7px]">
          <span className="h-[11px] w-[11px] rounded-[3px] bg-[#ff4b00]" />
          {t("appointmentsPage.internalMeetingBadge")}
        </span>
        <span className="flex items-center gap-[7px]">
          <span className="h-[11px] w-[11px] rounded-[3px] border border-white/40 bg-[#1a1a1a]" />
          {t("appointmentsPage.customerAppointmentLegend")}
        </span>
        <span className="flex items-center gap-[7px]">
          <Package size={13} className="text-white/50" />
          {t("appointmentsPage.orderStatusLegend")}
        </span>
        <span className="flex items-center gap-[6px]">
          <span className="h-[9px] w-[9px] rounded-full bg-violet-500" />
          {t("status.pending")}
        </span>
        <span className="flex items-center gap-[6px]">
          <span className="h-[9px] w-[9px] rounded-full bg-[#ff4b00]" />
          {t("status.approved")}
        </span>
        <span className="flex items-center gap-[6px]">
          <span className="h-[9px] w-[9px] rounded-full bg-emerald-500" />
          {t("status.completed")}
        </span>
        <span className="flex items-center gap-[6px]">
          <span className="h-[9px] w-[9px] rounded-full bg-red-500" />
          {t("status.rejected")}
        </span>
      </div>

      <div className="mt-[20px] flex items-center gap-[10px]">
        <button
          onClick={() => setWeekStart((d) => new Date(d.getTime() - 7 * 86400000))}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-[8px] border border-white/15 text-white/70 hover:bg-white/[0.06]"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="min-w-[160px] text-[14px] font-[700] text-white">{formatDateRange(weekStart)}</span>
        <button
          onClick={() => setWeekStart((d) => new Date(d.getTime() + 7 * 86400000))}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-[8px] border border-white/15 text-white/70 hover:bg-white/[0.06]"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => setWeekStart(startOfWeek(new Date()))}
          className="rounded-[8px] border border-white/15 px-[14px] py-[8px] text-[13px] font-[600] text-white/70 hover:bg-white/[0.06]"
        >
          {t("appointmentsPage.todayButton")}
        </button>
      </div>

      {error && <p className="mt-[14px] rounded-[8px] bg-red-500/10 px-[12px] py-[8px] text-[13px] text-red-300">{error}</p>}

      <div className="mt-[18px] overflow-x-auto rounded-[14px] border border-white/[0.08] bg-[#111212]">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-white/[0.08]">
            <div />
            {DAY_LABEL_KEYS.map((labelKey, i) => {
              const d = new Date(weekStart)
              d.setDate(d.getDate() + i)
              const isToday = d.toDateString() === new Date().toDateString()
              return (
                <div key={labelKey} className="border-l border-white/[0.08] px-[8px] py-[10px] text-center">
                  <p className="text-[11px] font-[600] uppercase tracking-[0.04em] text-white/45">{t(labelKey)}</p>
                  <p className={`text-[15px] font-[800] ${isToday ? "text-[#ff4b00]" : "text-white"}`}>{d.getDate()}</p>
                </div>
              )
            })}
          </div>

          {ordersByDay.some((d) => d.length > 0) && (
            <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-white/[0.08] bg-white/[0.012]">
              <div className="flex items-center justify-end px-[8px] py-[8px] text-[10px] text-white/30">
                <Calendar size={13} />
              </div>
              {ordersByDay.map((dayOrders, dayIndex) => (
                <div key={dayIndex} className="flex flex-col gap-[5px] border-l border-white/[0.08] p-[6px]">
                  {dayOrders.map((order) => (
                    <button
                      key={order._id}
                      onClick={() => setSelectedOrder(order)}
                      title={t("appointmentsPage.orderTooltip", { number: order.orderNumber, customer: order.customerName, status: t(`status.${order.status}`) })}
                      className={`flex flex-col items-start gap-[2px] rounded-[6px] border px-[8px] py-[7px] text-left transition-colors hover:brightness-125 ${
                        ORDER_CHIP_STYLE[order.status] || "border-white/20 bg-white/[0.06] text-white/60"
                      }`}
                    >
                      <span className="flex w-full items-center gap-[5px] truncate text-[11px] font-[700] leading-[1.2]">
                        <Package size={11} className="shrink-0" />
                        <span className="truncate">{order.customerName}</span>
                      </span>
                      <span className="truncate text-[9.5px] font-[800] uppercase leading-[1.2] tracking-[0.03em] opacity-90">
                        {t(`status.${order.status}`)}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="relative max-h-[70vh] overflow-y-auto">
          <div className="relative grid grid-cols-[56px_repeat(7,1fr)]">
            <div>
              {HOURS.map((h) => (
                <div key={h} style={{ height: ROW_HEIGHT }} className="border-b border-white/[0.06] px-[8px] pt-[4px] text-right text-[11px] text-white/35">
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            {byDay.map((events, dayIndex) => (
              <div key={dayIndex} className="relative border-l border-white/[0.08]">
                {HOURS.map((h) => (
                  <div key={h} style={{ height: ROW_HEIGHT }} className="border-b border-white/[0.06]" />
                ))}
                {events.map((appt) => {
                  const isPublicRequest = !appt.createdBy
                  const displayStatus = appointmentDisplayStatus(appt)
                  const order = appt.linkedOrder
                  // Once this meeting has turned into an order, the block
                  // shows the order's status/color/name automatically — no
                  // "Meeting" label left, no need to click in to see it.
                  const orderStyle = order ? ORDER_BLOCK_STYLE[order.status] || ORDER_BLOCK_FALLBACK : null
                  const colorClass = order
                    ? orderStyle.block
                    : isPublicRequest
                      ? "border border-white/40 bg-[#1a1a1a]"
                      : "bg-[#ff4b00]"
                  return (
                    <button
                      key={appt._id}
                      style={eventStyle(appt)}
                      onClick={() => setSelectedAppt(appt)}
                      className={`absolute left-[3px] right-[3px] overflow-hidden rounded-[6px] px-[8px] py-[4px] text-left text-white transition-opacity hover:opacity-90 ${
                        order ? "" : "shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
                      } ${colorClass} ${!order && displayStatus === "missed" ? "opacity-45" : ""}`}
                      title={
                        order
                          ? t("appointmentsPage.orderTooltip", { number: order.orderNumber, customer: order.customerName, status: t(`status.${order.status}`) })
                          : isPublicRequest
                            ? t("appointmentsPage.requestedByTooltip", { title: appt.title, name: appt.requestedByName })
                            : appt.title
                      }
                    >
                      <p className="flex items-center gap-[4px] truncate text-[11px] font-[700] leading-[1.25] text-white">
                        {order ? order.customerName : (
                          <>
                            {isPublicRequest && "🌐 "}
                            {appt.title}
                          </>
                        )}
                        {!order && displayStatus === "completed" && <CheckCheck size={11} className="shrink-0 text-white" />}
                      </p>
                      <p className={`mt-[1px] truncate text-[10px] leading-[1.25] ${order ? orderStyle.accent : "text-white/80"}`}>
                        {order ? (
                          <>
                            {formatShortDate(orderDateInfo(order, t).value)} · {t(`status.${order.status}`)}
                          </>
                        ) : (
                          <>
                            {new Date(appt.start).toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" })}–
                            {new Date(appt.end).toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" })}
                            {displayStatus === "missed" && ` · ${t("appointmentsPage.apptStatusMissed")}`}
                          </>
                        )}
                      </p>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          </div>
        </div>
      </div>

      {loading && <p className="mt-[10px] text-[13px] text-white/40">{t("appointmentsPage.loadingMeetings")}</p>}

      {showModal && (
        <NewMeetingModal
          weekStart={weekStart}
          onClose={() => setShowModal(false)}
          onCreated={(appt) => setAppointments((prev) => [...prev, appt])}
        />
      )}
      {selectedAppt && <AppointmentDetailModal appointment={selectedAppt} onClose={() => setSelectedAppt(null)} />}
      {selectedOrder && <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
    </div>
  )
}