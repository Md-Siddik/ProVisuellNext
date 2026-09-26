"use client"

import { useEffect, useState } from "react"
import { getLocale } from "@/lib/i18n/locale"
import Link from "next/link"
import { CalendarClock, FileDown, MapPin } from "lucide-react"
import { api } from "@/lib/api"
import MeetingTooEarlyModal from "@/components/MeetingTooEarlyModal"
import { useTranslation } from "@/lib/i18n"
import ProtectedRoute from "@/context/ProtectedRoute"
import { useTimeFormat } from "@/context/TimeFormatContext"
import TimeFormatToggle from "@/components/appointments/TimeFormatToggle"
import AttendanceBadge from "@/components/appointments/AttendanceBadge"
import { joinMeeting } from "@/lib/appointments/joinMeeting"
import { CancelDialog, RescheduleDialog } from "@/components/appointments/AppointmentActions"
import { customerCanCancel, customerCanReschedule } from "@/lib/appointments/attendance"

const STATUS_STYLE = {
  pending: "border-violet-500/40 text-violet-400",
  approved: "border-orange-500/40 text-orange-400",
  rejected: "border-red-500/40 text-red-400",
  completed: "border-emerald-500/40 text-emerald-400",
}


function formatDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "–"
  return d.toLocaleDateString(getLocale(), { day: "2-digit", month: "2-digit", year: "numeric" })
}

// Guards against stale/malformed dates (e.g. an old record with
// expectedDeliveryDate saved as "") rendering as "Invalid Date".
function isValidDate(value) {
  return Boolean(value) && !Number.isNaN(new Date(value).getTime())
}

// Same contextual date as the admin views — delivery date once approved,
// the actual completion date once delivered.
function orderDateInfo(order, t) {
  if (order.status === "completed") {
    if (isValidDate(order.completedAt)) return { label: t("myOrdersPage.completedDateLabel"), value: order.completedAt }
    if (isValidDate(order.expectedDeliveryDate)) return { label: t("myOrdersPage.deliveryDateLabel"), value: order.expectedDeliveryDate }
    return null
  }
  if (order.status === "approved" && isValidDate(order.expectedDeliveryDate)) {
    return { label: t("myOrdersPage.deliveryDateLabel"), value: order.expectedDeliveryDate }
  }
  return null
}

function MineBestillinger() {
  const { t } = useTranslation()
  const { formatInstantDateTime, formatInstantTime } = useTimeFormat()
  const [orders, setOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [orderIdsWithLocation, setOrderIdsWithLocation] = useState(new Set())
  const [appointments, setAppointments] = useState([])
  const [loadingAppointments, setLoadingAppointments] = useState(true)
  const [tooEarly, setTooEarly] = useState(null)
  const [rescheduling, setRescheduling] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [joiningId, setJoiningId] = useState(null)
  const [joinError, setJoinError] = useState("")
  // Server clock minus ours, so "Join" opens by the server's time. The join
  // endpoint enforces the same rule on its own; this only drives the button.
  const [clockSkew, setClockSkew] = useState(0)
  const [, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    api
      .get("/orders")
      .then((data) => !cancelled && setOrders(data.orders))
      .catch((err) => console.error(err))
      .finally(() => !cancelled && setLoadingOrders(false))
    // Viewing this page is what clears the "Min side" notification badge.
    api.post("/orders/mark-seen").catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    api
      .get("/locations/mine")
      .then((data) => !cancelled && setOrderIdsWithLocation(new Set(data.orderIds)))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    api
      .get("/appointments/mine")
      .then((data) => {
        if (cancelled) return
        setAppointments(data.appointments)
        if (data.serverTime) setClockSkew(new Date(data.serverTime).getTime() - Date.now())
      })
      .catch((err) => console.error(err))
      .finally(() => !cancelled && setLoadingAppointments(false))
    return () => {
      cancelled = true
    }
  }, [])

  // Re-evaluate the Join / Reschedule states as time passes — only while
  // there's an upcoming meeting and the tab is visible.
  const hasUpcoming = appointments.some((a) => a.status !== "cancelled" && new Date(a.end) > new Date())
  useEffect(() => {
    if (!hasUpcoming) return
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") setTick((n) => n + 1)
    }, 15000)
    return () => clearInterval(timer)
  }, [hasUpcoming])
  const serverNow = new Date(Date.now() + clockSkew)

  const replace = (updated) => setAppointments((prev) => prev.map((a) => (a._id === updated._id ? updated : a)))

  // Only this click counts as joining: the server records it and only then
  // releases the meeting URL, which opens in the new tab.
  const handleJoin = async (appointment) => {
    setJoinError("")
    setJoiningId(appointment._id)
    const result = await joinMeeting(appointment)
    setJoiningId(null)
    if (result.ok) replace(result.appointment)
    else if (result.code === "MEETING_NOT_STARTED") setTooEarly(appointment)
    else setJoinError(result.error?.message || t("authErrors.generic"))
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="mx-auto max-w-[720px] px-[24px] pb-[40px] pt-[110px] sm:px-[40px]">
        <h1 className="text-[26px] font-[800] tracking-[-0.02em] text-white">{t("myOrdersPage.title")}</h1>
        <p className="mt-[4px] text-[14px] text-white/50">
          {t("myOrdersPage.subtitle")}
        </p>

        <div className="mt-[22px] space-y-[12px]">
          {loadingOrders && <p className="text-[13px] text-white/40">{t("myOrdersPage.loadingOrders")}</p>}
          {!loadingOrders && orders.length === 0 && (
            <div className="rounded-[14px] border border-white/[0.08] bg-[#111212] p-[24px] text-center">
              <p className="text-[14px] text-white/60">{t("myOrdersPage.noOrders")}</p>
              <p className="mt-[4px] text-[13px] text-white/40">
                {t("myOrdersPage.noOrdersHint")}
              </p>
            </div>
          )}
          {orders.map((o) => {
            const dateInfo = orderDateInfo(o, t)
            const needsLocation = ["pending", "approved"].includes(o.status) && !orderIdsWithLocation.has(o._id)
            return (
              <div key={o._id} className="rounded-[14px] border border-white/[0.08] bg-[#111212] transition hover:border-white/20">
                <div className="flex items-center justify-between gap-[12px] p-[18px]">
                  <Link href={`/mine-bestillinger/${o._id}`} className="min-w-0 flex-1">
                    <p className="text-[14px] font-[700] text-white">#{o.orderNumber}</p>
                    <p className="mt-[2px] text-[13px] text-white/50">{o.service}</p>
                    {dateInfo && (
                      <p className="mt-[2px] text-[12px] text-white/40">
                        {dateInfo.label}: {formatDate(dateInfo.value)}
                      </p>
                    )}
                  </Link>
                  <div className="flex shrink-0 items-center gap-[10px]">
                    {o.invoice && o.status === "completed" && (
                      <Link
                        href={`/faktura/${o.invoice._id}`}
                        title={t("myOrdersPage.downloadInvoiceTitle")}
                        className="flex h-[32px] items-center gap-[6px] rounded-[6px] border border-[#ff4b00]/40 bg-[#ff4b00]/[0.08] px-[10px] text-[11px] font-[700] text-[#ff4b00] hover:bg-[#ff4b00]/[0.16]"
                      >
                        <FileDown size={13} />
                        {t("myOrdersPage.invoiceLabel")}
                      </Link>
                    )}
                    <span className={`rounded-[6px] border px-[10px] py-[4px] text-[11px] font-[800] ${STATUS_STYLE[o.status]}`}>
                      {t(`status.${o.status}`)}
                    </span>
                  </div>
                </div>
                {needsLocation && (
                  <div className="flex flex-wrap items-center justify-between gap-[10px] border-t border-[#ff4b00]/20 bg-[#ff4b00]/[0.06] px-[18px] py-[12px]">
                    <span className="flex items-center gap-[8px] text-[12.5px] text-[#ff4b00]">
                      <MapPin size={14} />
                      {t("myOrdersPage.locationReminderText")}
                    </span>
                    <Link
                      href={`/mine-bestillinger/${o._id}#service-location`}
                      className="rounded-[7px] bg-[#ff4b00] px-[12px] py-[6px] text-[11.5px] font-[800] uppercase tracking-[0.02em] text-white hover:brightness-110"
                    >
                      {t("myOrdersPage.locationReminderButton")}
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-[40px] flex flex-wrap items-end justify-between gap-[12px]">
          <div>
            <h2 className="text-[20px] font-[800] tracking-[-0.02em] text-white">{t("myOrdersPage.myAppointments")}</h2>
            <p className="mt-[4px] text-[14px] text-white/50">{t("myOrdersPage.appointmentsSubtitle")}</p>
          </div>
          <TimeFormatToggle />
        </div>

        <div className="mt-[18px] space-y-[12px]">
          {loadingAppointments && <p className="text-[13px] text-white/40">{t("myOrdersPage.loadingAppointments")}</p>}
          {joinError && <p className="rounded-[8px] bg-red-500/10 px-[12px] py-[8px] text-[13px] text-red-300">{joinError}</p>}
          {!loadingAppointments && appointments.length === 0 && (
            <div className="rounded-[14px] border border-white/[0.08] bg-[#111212] p-[24px] text-center">
              <p className="text-[14px] text-white/60">{t("myOrdersPage.noAppointments")}</p>
            </div>
          )}
          {appointments.map((a) => (
            <div key={a._id} className="flex flex-wrap items-center justify-between gap-[12px] rounded-[14px] border border-white/[0.08] bg-[#111212] p-[18px]">
              <div className="flex items-center gap-[14px]">
                <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-[#ff4b00]/15 text-[#ff4b00]">
                  <CalendarClock size={18} />
                </span>
                <div>
                  <p className="flex flex-wrap items-center gap-[8px] text-[14px] font-[700] text-white">
                    {a.title}
                    {a.status !== "cancelled" && <AttendanceBadge appointment={a} />}
                  </p>
                  <p className="mt-[2px] text-[13px] tabular-nums text-white/50">
                    {formatInstantDateTime(a.start)}–{formatInstantTime(a.end)} · {t("timeFormat.norwayTime")}
                  </p>
                </div>
              </div>
              {a.status === "cancelled" ? (
                <span className="rounded-[6px] border border-red-500/40 px-[10px] py-[4px] text-[11px] font-[800] text-red-400">
                  {t("myOrdersPage.appointmentCancelled")}
                </span>
              ) : new Date(a.end) > serverNow ? (
                <div className="flex shrink-0 flex-col items-end gap-[6px]">
                  {serverNow >= new Date(a.start) ? (
                    <button
                      type="button"
                      onClick={() => handleJoin(a)}
                      disabled={joiningId === a._id}
                      className="rounded-[8px] bg-[#ff4b00] px-[14px] py-[8px] text-[11.5px] font-[800] uppercase tracking-[0.02em] text-white hover:brightness-110 disabled:opacity-60"
                    >
                      {joiningId === a._id ? t("appointmentActions.joining") : t("appointmentActions.joinMeeting")}
                    </button>
                  ) : (
                    // Disabled until the start — the link doesn't exist on this page yet.
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      className="cursor-not-allowed rounded-[8px] border border-white/15 bg-white/[0.04] px-[14px] py-[8px] text-[11.5px] font-[700] tabular-nums text-white/55"
                    >
                      {t("appointmentActions.availableAt", { time: formatInstantTime(a.start) })}
                    </button>
                  )}
                  <div className="flex gap-[10px] text-[12px]">
                    {customerCanReschedule(a, serverNow) ? (
                      <button type="button" onClick={() => setRescheduling(a)} className="font-[700] text-white/70 hover:text-white">
                        {t("appointmentActions.reschedule")}
                      </button>
                    ) : (
                      !a.joinedAt && <span className="text-white/35" title={t("appointmentActions.rescheduleClosed")}>{t("appointmentActions.rescheduleClosedShort")}</span>
                    )}
                    {customerCanCancel(a, serverNow) && (
                      <button type="button" onClick={() => setCancelling(a)} className="font-[700] text-red-300/80 hover:text-red-300">
                        {t("appointmentActions.cancel")}
                      </button>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </main>
      {tooEarly && <MeetingTooEarlyModal start={tooEarly.start} onClose={() => setTooEarly(null)} />}
      {rescheduling && (
        <RescheduleDialog
          appointment={rescheduling}
          onClose={() => setRescheduling(null)}
          onDone={(updated) => {
            replace(updated)
            setRescheduling(null)
          }}
        />
      )}
      {cancelling && (
        <CancelDialog
          appointment={cancelling}
          onClose={() => setCancelling(null)}
          onDone={(updated) => {
            replace({ ...cancelling, ...updated })
            setCancelling(null)
          }}
        />
      )}
    </div>
  )
}

export default function MineBestillingerPage() {
  return (
    <ProtectedRoute roles={["customer"]}>
      <MineBestillinger />
    </ProtectedRoute>
  )
}
