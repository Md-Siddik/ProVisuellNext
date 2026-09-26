"use client"

import { useEffect, useMemo, useState } from "react"
import { getLocale } from "@/lib/i18n/locale"
import Link from "next/link"
import { useAuth } from "@/context/AuthContext"
import {
  Calendar,
  CalendarCog,
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
import TimeFormatToggle from "../../components/appointments/TimeFormatToggle"
import AttendanceBadge from "../../components/appointments/AttendanceBadge"
import { joinMeeting } from "@/lib/appointments/joinMeeting"
import AddNoteButton from "../../components/notes/AddNoteButton"
import { CancelDialog, RescheduleDialog } from "../../components/appointments/AppointmentActions"
import { useTranslation } from "@/lib/i18n"
import { useTimeFormat } from "@/context/TimeFormatContext"
import {
  addDays,
  formatDateString,
  generateDailySlots,
  getNorwayNow,
  osloParts,
  osloToUtc,
  startOfWeekDate,
} from "@/lib/appointments/time"


const DAY_LABEL_KEYS = [
  "appointmentsPage.dayMon",
  "appointmentsPage.dayTue",
  "appointmentsPage.dayWed",
  "appointmentsPage.dayThu",
  "appointmentsPage.dayFri",
  "appointmentsPage.daySat",
  "appointmentsPage.daySun",
]
// The calendar is laid out in Norway time (Europe/Oslo), whatever timezone
// the viewer's browser is in, so it lines up with booking availability.
//
// Floors, not limits — the grid always spans at least 08:00–18:00, and
// widens to fit whatever early-morning or late-evening appointments
// actually exist that week (customers can book any of the 48 daily slots).
const MIN_START_HOUR = 8
const MIN_END_HOUR = 18
const ROW_HEIGHT = 84 // px per hour, must match the h-[84px] rows below — tall enough that even a 30-min slot fits a title + time line

// Staff can pick quarter hours for internal meetings.
const QUARTER_HOURS = generateDailySlots({ intervalMinutes: 15 })

function useHourRange(appointments) {
  return useMemo(() => {
    let start = MIN_START_HOUR
    let end = MIN_END_HOUR
    for (const appt of appointments) {
      if (appt.status === "cancelled") continue
      const s = new Date(appt.start)
      const e = new Date(appt.end)
      if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) continue
      const sp = osloParts(s)
      const ep = osloParts(e)
      if (sp.hour < start) start = sp.hour
      // A meeting ending after midnight Oslo time fills the rest of its day.
      const hour = ep.date !== sp.date ? 24 : ep.hour + (ep.minute > 0 ? 1 : 0)
      if (hour > end) end = hour
    }
    return { startHour: start, endHour: Math.min(end, 24) }
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

function formatDateRange(monday) {
  const fmt = (d) => formatDateString(d, getLocale(), { day: "numeric", month: "short" })
  return `${fmt(monday)} – ${fmt(addDays(monday, 6))}`
}

// scheduled/completed/cancelled is what's persisted — "missed" is derived
// here (a scheduled slot whose end time has passed) rather than stored, so
// it always reflects reality without a background job.
function appointmentDisplayStatus(appt) {
  if (appt.status === "cancelled") return "cancelled"
  if (appt.status === "completed") return "completed"
  // Past: joined (the Join button was used) or missed — see lib/appointments/attendance.
  if (new Date(appt.end) < new Date()) return appt.joinedAt ? "joined" : "missed"
  return "booked"
}

const APPT_STATUS_LABEL_KEYS = {
  booked: "appointmentsPage.apptStatusBooked",
  missed: "appointmentsPage.apptStatusMissed",
  joined: "attendance.joined",
  completed: "appointmentsPage.apptStatusCompleted",
  cancelled: "appointmentsPage.apptStatusCancelled",
}
const APPT_STATUS_BADGE = {
  booked: "border-[#ff4b00]/40 text-[#ff4b00]",
  missed: "border-white/25 text-white/45",
  joined: "border-emerald-500/40 text-emerald-400",
  completed: "border-emerald-500/40 text-emerald-400",
  cancelled: "border-red-500/40 text-red-400",
}

function NewMeetingModal({ weekStart, onClose, onCreated }) {
  const { t } = useTranslation()
  const { formatTime } = useTimeFormat()
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
    // Entered times are Norway time, converted to the exact instant here.
    const date = addDays(weekStart, Number(day))
    const startDate = osloToUtc(date, start)
    const endDate = osloToUtc(date, end)
    if (!startDate || !endDate) {
      setError(t("appointmentsPage.errorNonexistentTime"))
      return
    }

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
          <div>
            <h2 className="text-[18px] font-[800] text-white">{t("appointmentsPage.newMeetingTitle")}</h2>
            <p className="mt-[2px] text-[11.5px] text-white/40">{t("timeFormat.norwayTime")}</p>
          </div>
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
              {DAY_LABEL_KEYS.map((labelKey, i) => (
                <option key={labelKey} value={i} className="bg-[#111212]">
                  {t(labelKey)} {Number(addDays(weekStart, i).slice(8))}.
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-[12px]">
            <div className="flex-1">
              <label className="mb-[6px] block text-[12px] font-[600] text-white/70">{t("appointmentsPage.fromLabel")}</label>
              <select
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[12px] py-[9px] text-[13px] tabular-nums text-white outline-none focus:border-[#ff4b00]"
              >
                {QUARTER_HOURS.map((q) => (
                  <option key={q} value={q} className="bg-[#111212]">
                    {formatTime(q)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-[6px] block text-[12px] font-[600] text-white/70">{t("appointmentsPage.toLabel")}</label>
              <select
                required
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[12px] py-[9px] text-[13px] tabular-nums text-white outline-none focus:border-[#ff4b00]"
              >
                {QUARTER_HOURS.map((q) => (
                  <option key={q} value={q} className="bg-[#111212]">
                    {formatTime(q)}
                  </option>
                ))}
              </select>
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

function AppointmentDetailModal({ appointment, onClose, onChanged }) {
  const { t } = useTranslation()
  const { formatInstantDate, formatInstantTime } = useTimeFormat()
  const isPublicRequest = !appointment.createdBy
  const displayStatus = appointmentDisplayStatus(appointment)
  const order = appointment.linkedOrder
  const [tooEarly, setTooEarly] = useState(false)

  const { can } = useAuth()
  const [joinState, setJoinState] = useState(appointment)
  const [joinError, setJoinError] = useState("")
  const [dialog, setDialog] = useState(null) // "reschedule" | "cancel"
  const handleJoinClick = async () => {
    setJoinError("")
    const result = await joinMeeting(appointment)
    if (result.ok) setJoinState(result.appointment)
    else if (result.code === "MEETING_NOT_STARTED") setTooEarly(true)
    else setJoinError(result.error?.message || "")
  }
  const upcoming = new Date(appointment.end) > new Date()

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
            <span className="tabular-nums">
              {formatInstantDate(appointment.start, { dateStyle: "full" })} {formatInstantTime(appointment.start)} – {formatInstantTime(appointment.end)}
              <span className="text-white/40"> · {t("timeFormat.norwayTime")}</span>
            </span>
          </p>
          <p className="flex items-center gap-[10px]">
            <Mail size={15} className="shrink-0 text-white/40" />
            {appointment.requestedByName}
            {/* The API leaves the address out for viewers without customers.viewEmail. */}
            {appointment.requestedByEmail && ` (${appointment.requestedByEmail})`}
          </p>
          {displayStatus !== "cancelled" && (
            <p className="flex items-center gap-[10px]">
              <span className="text-white/45">{t("attendance.label")}</span>
              <AttendanceBadge appointment={joinState} showTime />
            </p>
          )}
          {appointment.notes && <p className="rounded-[8px] bg-white/[0.03] p-[10px] text-white/60">{appointment.notes}</p>}
          <AddNoteButton type="appointment" id={appointment._id} className="pt-[4px]" />
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

        {displayStatus !== "cancelled" && upcoming && (
          <button
            type="button"
            onClick={handleJoinClick}
            className="mt-[18px] flex w-full items-center justify-center gap-[8px] rounded-[10px] bg-[#ff4b00] py-[11px] text-[13px] font-[800] uppercase tracking-[0.02em] text-white hover:brightness-110"
          >
            <Video size={15} />
            {t("appointmentsPage.joinMeetingButton")}
          </button>
        )}
        {joinError && <p className="mt-[8px] text-[12.5px] text-red-300">{joinError}</p>}
        {displayStatus !== "cancelled" && (can("appointments.reschedule") || can("appointments.cancel")) && (
          <div className="mt-[10px] grid grid-cols-2 gap-[8px]">
            {can("appointments.reschedule") && (
              <button
                type="button"
                onClick={() => setDialog("reschedule")}
                className="rounded-[10px] border border-white/15 py-[10px] text-[12.5px] font-[700] text-white/80 hover:bg-white/[0.06]"
              >
                {t("appointmentActions.reschedule")}
              </button>
            )}
            {can("appointments.cancel") && (
              <button
                type="button"
                onClick={() => setDialog("cancel")}
                className="rounded-[10px] border border-red-500/30 py-[10px] text-[12.5px] font-[700] text-red-300 hover:bg-red-500/10"
              >
                {t("appointmentActions.cancel")}
              </button>
            )}
          </div>
        )}
      </div>
      {tooEarly && <MeetingTooEarlyModal start={appointment.start} onClose={() => setTooEarly(false)} />}
      {dialog === "reschedule" && (
        <RescheduleDialog
          staff
          appointment={appointment}
          onClose={() => setDialog(null)}
          onDone={(updated) => {
            setDialog(null)
            onChanged({ ...appointment, ...updated })
          }}
        />
      )}
      {dialog === "cancel" && (
        <CancelDialog
          appointment={appointment}
          onClose={() => setDialog(null)}
          onDone={(updated) => {
            setDialog(null)
            onChanged({ ...appointment, ...updated })
          }}
        />
      )}
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
          <AddNoteButton type="order" id={order._id} className="pt-[4px]" />
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
  const { role, can } = useAuth()
  const { formatTime, formatInstantTime } = useTimeFormat()
  const base = role === "owner" ? "/dashboard/owner" : "/dashboard/admin"
  // Monday of the shown week, as an Oslo calendar date ("YYYY-MM-DD").
  const [weekStart, setWeekStart] = useState(() => startOfWeekDate(getNorwayNow().date))
  const [appointments, setAppointments] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedAppt, setSelectedAppt] = useState(null)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [error, setError] = useState("")

  // ?appointment=<id> (e.g. "Open record" on a note): jump to its week and open it.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("appointment")
    if (!id) return
    api
      .get(`/appointments?id=${encodeURIComponent(id)}`)
      .then(({ appointments: found }) => {
        const appt = found?.[0]
        if (!appt) return
        setWeekStart(startOfWeekDate(osloParts(appt.start).date))
        setSelectedAppt(appt)
      })
      .catch(() => {})
  }, [])

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const todayOslo = getNorwayNow().date

  const { startHour, endHour } = useHourRange(appointments)
  const HOURS = useMemo(
    () => Array.from({ length: endHour - startHour }, (_, i) => startHour + i),
    [startHour, endHour]
  )

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError("")
      try {
        const from = osloToUtc(weekStart, "00:00").toISOString()
        const to = osloToUtc(addDays(weekStart, 7), "00:00").toISOString()
        const [apptData, orderData] = await Promise.all([
          api.get(`/appointments?from=${from}&to=${to}`),
          api.get(`/orders?deliveryFrom=${from}&deliveryTo=${to}&limit=100`),
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
  }, [weekStart])

  const byDay = useMemo(() => {
    const map = Array.from({ length: 7 }, () => [])
    for (const appt of appointments) {
      if (appt.status === "cancelled") continue
      const dayIndex = weekDates.indexOf(osloParts(appt.start).date)
      if (dayIndex >= 0) map[dayIndex].push(appt)
    }
    return map
  }, [appointments, weekDates])

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
      const dayIndex = weekDates.indexOf(osloParts(d).date)
      if (dayIndex >= 0) map[dayIndex].push(order)
    }
    return map
  }, [orders, weekDates])

  const eventStyle = (appt) => {
    const start = new Date(appt.start)
    const end = new Date(appt.end)
    const p = osloParts(start)
    const startMinutes = (p.hour - startHour) * 60 + p.minute
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
        <div className="flex flex-wrap items-center gap-[10px]">
          {can("appointments.manageAvailability") && (
          <Link
            href={`${base}/motetilgjengelighet`}
            className="inline-flex items-center gap-[8px] rounded-[10px] border border-white/15 px-[14px] py-[10px] text-[13px] font-[700] text-white/80 hover:bg-white/[0.06]"
          >
            <CalendarCog size={15} />
            {t("availabilityPage.navLabel")}
          </Link>
          )}
          {can("appointments.create") && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-[8px] rounded-[10px] bg-[#ff4b00] px-[16px] py-[10px] text-[13px] font-[800] uppercase tracking-[0.02em] text-white hover:brightness-110"
          >
            <Plus size={15} />
            {t("appointmentsPage.newMeetingTitle")}
          </button>
          )}
        </div>
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
          onClick={() => setWeekStart((d) => addDays(d, -7))}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-[8px] border border-white/15 text-white/70 hover:bg-white/[0.06]"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="min-w-[160px] text-[14px] font-[700] text-white">{formatDateRange(weekStart)}</span>
        <button
          onClick={() => setWeekStart((d) => addDays(d, 7))}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-[8px] border border-white/15 text-white/70 hover:bg-white/[0.06]"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => setWeekStart(startOfWeekDate(getNorwayNow().date))}
          className="rounded-[8px] border border-white/15 px-[14px] py-[8px] text-[13px] font-[600] text-white/70 hover:bg-white/[0.06]"
        >
          {t("appointmentsPage.todayButton")}
        </button>
        <span className="ml-auto flex items-center gap-[12px]">
          <span className="hidden text-[12px] text-white/40 sm:inline">{t("timeFormat.norwayTime")}</span>
          <TimeFormatToggle showLabel={false} />
        </span>
      </div>

      {error && <p className="mt-[14px] rounded-[8px] bg-red-500/10 px-[12px] py-[8px] text-[13px] text-red-300">{error}</p>}

      <div className="mt-[18px] overflow-x-auto rounded-[14px] border border-white/[0.08] bg-[#111212]">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-white/[0.08]">
            <div />
            {DAY_LABEL_KEYS.map((labelKey, i) => {
              const isToday = weekDates[i] === todayOslo
              return (
                <div key={labelKey} className="border-l border-white/[0.08] px-[8px] py-[10px] text-center">
                  <p className="text-[11px] font-[600] uppercase tracking-[0.04em] text-white/45">{t(labelKey)}</p>
                  <p className={`text-[15px] font-[800] ${isToday ? "text-[#ff4b00]" : "text-white"}`}>{Number(weekDates[i].slice(8))}</p>
                </div>
              )
            })}
          </div>

          {ordersByDay.some((d) => d.length > 0) && (
            <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-white/[0.08] bg-white/[0.012]">
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
          <div className="relative grid grid-cols-[64px_repeat(7,1fr)]">
            <div>
              {HOURS.map((h) => (
                <div key={h} style={{ height: ROW_HEIGHT }} className="border-b border-white/[0.06] px-[6px] pt-[4px] text-right text-[10.5px] tabular-nums text-white/35">
                  {formatTime(`${String(h).padStart(2, "0")}:00`)}
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
                            {formatInstantTime(appt.start)}–{formatInstantTime(appt.end)}
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
      {selectedAppt && (
        <AppointmentDetailModal
          appointment={selectedAppt}
          onClose={() => setSelectedAppt(null)}
          // Rescheduled/cancelled: move or drop the block in place.
          onChanged={(updated) => {
            setAppointments((prev) => prev.map((a) => (a._id === updated._id ? updated : a)))
            setSelectedAppt(null)
          }}
        />
      )}
      {selectedOrder && <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
    </div>
  )
}