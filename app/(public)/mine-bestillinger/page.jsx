"use client"

import { useEffect, useState } from "react"
import { getLocale } from "@/lib/i18n/locale"
import Link from "next/link"
import { CalendarClock, FileDown, MapPin } from "lucide-react"
import { api } from "@/lib/api"
import MeetingTooEarlyModal from "@/components/MeetingTooEarlyModal"
import { useTranslation } from "@/lib/i18n"
import ProtectedRoute from "@/context/ProtectedRoute"

const STATUS_STYLE = {
  pending: "border-violet-500/40 text-violet-400",
  approved: "border-orange-500/40 text-orange-400",
  rejected: "border-red-500/40 text-red-400",
  completed: "border-emerald-500/40 text-emerald-400",
}

const MEET_LINK = process.env.NEXT_PUBLIC_MEET_LINK || ""

function formatDateTime(iso) {
  return new Date(iso).toLocaleString(getLocale(), { dateStyle: "medium", timeStyle: "short" })
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
  const [orders, setOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [orderIdsWithLocation, setOrderIdsWithLocation] = useState(new Set())
  const [appointments, setAppointments] = useState([])
  const [loadingAppointments, setLoadingAppointments] = useState(true)
  const [tooEarly, setTooEarly] = useState(null)

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
      .then((data) => !cancelled && setAppointments(data.appointments))
      .catch((err) => console.error(err))
      .finally(() => !cancelled && setLoadingAppointments(false))
    return () => {
      cancelled = true
    }
  }, [])

  const handleJoin = async (appointment) => {
    if (new Date(appointment.start) > new Date()) {
      setTooEarly(appointment)
      return
    }
    if (MEET_LINK) window.open(MEET_LINK, "_blank", "noopener,noreferrer")
    try {
      await api.patch(`/appointments/${appointment._id}/join`)
      setAppointments((prev) => prev.filter((a) => a._id !== appointment._id))
    } catch (err) {
      console.error(err)
    }
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

        <h2 className="mt-[40px] text-[20px] font-[800] tracking-[-0.02em] text-white">{t("myOrdersPage.myAppointments")}</h2>
        <p className="mt-[4px] text-[14px] text-white/50">{t("myOrdersPage.appointmentsSubtitle")}</p>

        <div className="mt-[18px] space-y-[12px]">
          {loadingAppointments && <p className="text-[13px] text-white/40">{t("myOrdersPage.loadingAppointments")}</p>}
          {!loadingAppointments && appointments.length === 0 && (
            <div className="rounded-[14px] border border-white/[0.08] bg-[#111212] p-[24px] text-center">
              <p className="text-[14px] text-white/60">{t("myOrdersPage.noAppointments")}</p>
            </div>
          )}
          {appointments.map((a) => (
            <div key={a._id} className="flex items-center justify-between rounded-[14px] border border-white/[0.08] bg-[#111212] p-[18px]">
              <div className="flex items-center gap-[14px]">
                <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-[#ff4b00]/15 text-[#ff4b00]">
                  <CalendarClock size={18} />
                </span>
                <div>
                  <p className="text-[14px] font-[700] text-white">{a.title}</p>
                  <p className="mt-[2px] text-[13px] text-white/50">{formatDateTime(a.start)}</p>
                </div>
              </div>
              {a.status === "cancelled" ? (
                <span className="rounded-[6px] border border-red-500/40 px-[10px] py-[4px] text-[11px] font-[800] text-red-400">
                  {t("myOrdersPage.appointmentCancelled")}
                </span>
              ) : MEET_LINK ? (
                <button
                  type="button"
                  onClick={() => handleJoin(a)}
                  className="rounded-[8px] bg-[#ff4b00] px-[14px] py-[8px] text-[11.5px] font-[800] uppercase tracking-[0.02em] text-white hover:brightness-110"
                >
                  {t("myOrdersPage.join")}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </main>
      {tooEarly && <MeetingTooEarlyModal start={tooEarly.start} onClose={() => setTooEarly(null)} />}
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
