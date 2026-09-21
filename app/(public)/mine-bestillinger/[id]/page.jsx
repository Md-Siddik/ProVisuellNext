"use client"

import { useEffect, useRef, useState } from "react"
import { getLocale } from "@/lib/i18n/locale"
import Link from "next/link"
import { useParams } from "next/navigation"
import { CalendarClock, CheckCircle2, Clock, FileDown, FileText, LayoutGrid, MapPin, Wallet } from "lucide-react"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import LocationPickerModal from "@/components/LocationPickerModal"
import { ACCURACY_QUALITY_STYLE, getAccuracyQuality } from "@/lib/locationQuality"
import ProtectedRoute from "@/context/ProtectedRoute"

function getStatusCopy(t) {
  return {
    pending: { title: t("orderConfirmationPage.statusPendingTitle"), subtitle: t("orderConfirmationPage.statusPendingSubtitle") },
    approved: { title: t("orderConfirmationPage.statusApprovedTitle"), subtitle: t("orderConfirmationPage.statusApprovedSubtitle") },
    rejected: { title: t("orderConfirmationPage.statusRejectedTitle"), subtitle: t("orderConfirmationPage.statusRejectedSubtitle") },
    completed: {
      title: t("orderConfirmationPage.statusCompletedTitle"),
      subtitle: (
        <>
          {t("orderConfirmationPage.statusCompletedSubtitlePrefix")}{" "}
          <span className="notranslate" translate="no">
            ProVisuell
          </span>
          {t("orderConfirmationPage.statusCompletedSubtitleSuffix")}
        </>
      ),
    },
  }
}

const BADGE_STYLE = {
  pending: "border-violet-500/40 text-violet-400",
  approved: "border-[#ff4b00]/40 text-[#ff4b00]",
  rejected: "border-red-500/40 text-red-400",
  completed: "border-emerald-500/40 text-emerald-400",
}

// Guards against stale/malformed dates (e.g. an old record with
// expectedDeliveryDate saved as "") rendering as "Invalid Date".
function isValidDate(value) {
  return Boolean(value) && !Number.isNaN(new Date(value).getTime())
}

function formatDateTime(value) {
  if (!value) return "–"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "–"
  return d.toLocaleString(getLocale(), { dateStyle: "medium", timeStyle: "short" })
}

// Delivery date once approved, actual completion date once delivered.
function orderDateInfo(order, t) {
  if (order.status === "completed") {
    if (isValidDate(order.completedAt)) return { label: t("orderConfirmationPage.completedDateLabel"), value: order.completedAt }
    if (isValidDate(order.expectedDeliveryDate)) return { label: t("orderConfirmationPage.deliveryDateLabel"), value: order.expectedDeliveryDate }
    return null
  }
  if (order.status === "approved" && isValidDate(order.expectedDeliveryDate)) {
    return { label: t("orderConfirmationPage.deliveryDateLabel"), value: order.expectedDeliveryDate }
  }
  return null
}

function OrderConfirmation() {
  const { t } = useTranslation()
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState("")
  const [location, setLocation] = useState(null)
  const [loadingLocation, setLoadingLocation] = useState(true)
  const [pickerOpen, setPickerOpen] = useState(false)
  const locationSectionRef = useRef(null)

  useEffect(() => {
    api
      .get(`/orders/${id}`)
      .then((data) => setOrder(data.order))
      .catch((err) => setError(err.message))
  }, [id])

  useEffect(() => {
    let cancelled = false
    api
      .get(`/locations/order/${id}`)
      .then((data) => !cancelled && setLocation(data.location))
      .catch(() => {})
      .finally(() => !cancelled && setLoadingLocation(false))
    return () => {
      cancelled = true
    }
  }, [id])

  // Lets "Del lokasjon" on the order list jump straight to this section
  // (e.g. /mine-bestillinger/:id#service-location) without auto-requesting
  // geolocation — the customer still has to click the share button.
  useEffect(() => {
    if (!loadingLocation && window.location.hash === "#service-location") {
      locationSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [loadingLocation])

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-[20px] text-center text-white">
        <p className="text-[14px] text-white/60">{error}</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[#ff4b00]" />
      </div>
    )
  }

  const copy = getStatusCopy(t)[order.status]
  const dateInfo = orderDateInfo(order, t)

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="mx-auto flex max-w-[560px] flex-col items-center px-[24px] pb-[40px] pt-[110px] text-center">
        <div className={`flex h-[90px] w-[90px] items-center justify-center rounded-full border-2 ${BADGE_STYLE[order.status]}`}>
          <CheckCircle2 size={40} />
        </div>

        <p className="mt-[20px] text-[13px] font-[800] uppercase tracking-[0.03em] text-[#ff4b00]">{t("orderConfirmationPage.thankYou")}</p>
        <h1 className="mt-[8px] text-[30px] font-[800] tracking-[-0.02em] text-white">{copy.title}</h1>
        <p className="mt-[10px] text-[14px] leading-[1.5] text-white/55">{copy.subtitle}</p>

        <div className="mt-[28px] w-full space-y-[14px] rounded-[16px] border border-white/[0.08] bg-[#111212] p-[22px] text-left">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-[10px] text-[13px] text-white/55">
              <FileText size={16} className="text-white/40" /> {t("orderConfirmationPage.orderId")}
            </span>
            <span className="text-[13px] font-[700] text-white">{order.orderNumber}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-[10px] text-[13px] text-white/55">
              <Clock size={16} className="text-white/40" /> {t("orderConfirmationPage.orderDate")}
            </span>
            <span className="text-[13px] font-[700] text-white">
              {new Date(order.createdAt).toLocaleString(getLocale(), { dateStyle: "long", timeStyle: "short" })}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-[10px] text-[13px] text-white/55">
              <LayoutGrid size={16} className="text-white/40" /> {t("orderConfirmationPage.service")}
            </span>
            <span className="text-[13px] font-[700] text-white">{order.service}</span>
          </div>
          {order.amount > 0 && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-[10px] text-[13px] text-white/55">
                <Wallet size={16} className="text-white/40" /> {t("common.amount")}
              </span>
              <span className="text-[13px] font-[800] text-[#ff4b00]">kr {order.amount.toLocaleString("no-NO")},-</span>
            </div>
          )}
          {dateInfo && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-[10px] text-[13px] text-white/55">
                <CalendarClock size={16} className="text-white/40" /> {dateInfo.label}
              </span>
              <span className="text-[13px] font-[700] text-white">
                {new Date(dateInfo.value).toLocaleDateString(getLocale(), { dateStyle: "long" })}
              </span>
            </div>
          )}
          <div className="border-t border-white/[0.08] pt-[14px] text-left">
            <p className="text-[12px] font-[600] uppercase tracking-[0.03em] text-white/40">{t("common.description")}</p>
            <p className="mt-[6px] text-[13.5px] leading-[1.5] text-white/75">{order.specification}</p>
          </div>
        </div>

        <div
          id="service-location"
          ref={locationSectionRef}
          className="mt-[16px] w-full rounded-[16px] border border-[#ff4b00]/25 bg-[#111212] p-[22px] text-left"
        >
          <div className="flex items-center gap-[10px]">
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#ff4b00]/15 text-[#ff4b00]">
              <MapPin size={17} />
            </span>
            <p className="text-[15px] font-[800] text-white">{t("locationPicker.sectionTitle")}</p>
          </div>
          <p className="mt-[8px] text-[13px] leading-[1.5] text-white/60">{t("locationPicker.description")}</p>

          {loadingLocation ? (
            <p className="mt-[14px] text-[13px] text-white/40">{t("common.loading")}</p>
          ) : location ? (
            <div className="mt-[14px] rounded-[10px] border border-emerald-500/25 bg-emerald-500/[0.06] px-[14px] py-[12px]">
              <p className="text-[13px] font-[700] text-emerald-300">{t("locationPicker.sharedTitle")}</p>
              <p className="mt-[4px] text-[12.5px] text-white/65">
                {t("locationPicker.lastUpdatedLabel")}: {formatDateTime(location.locatedAt || location.updatedAt)}
              </p>
              {Number.isFinite(location.locationAccuracy) && (
                <p className="mt-[2px] flex items-center gap-[6px] text-[12.5px] text-white/65">
                  {t("locationPicker.accuracyValue", { n: Math.round(location.locationAccuracy) })}
                  {(() => {
                    const quality = getAccuracyQuality(location.locationAccuracy)
                    return (quality === "low" || quality === "unreliable") && (
                      <span className={`text-[11px] font-[700] ${ACCURACY_QUALITY_STYLE[quality]}`}>
                        · {t(`locationPicker.quality_${quality}`)}
                      </span>
                    )
                  })()}
                </p>
              )}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="mt-[14px] w-full rounded-[10px] bg-[#ff4b00] py-[12px] text-[13px] font-[800] uppercase tracking-[0.02em] text-white hover:brightness-110"
          >
            {location ? t("locationPicker.updateButton") : t("locationPicker.shareButton")}
          </button>
        </div>

        {order.invoice && order.status === "completed" && (
          <Link
            href={`/faktura/${order.invoice._id}`}
            className="mt-[16px] flex w-full items-center justify-center gap-[8px] rounded-[10px] border border-[#ff4b00]/40 bg-[#ff4b00]/[0.08] px-[18px] py-[12px] text-[13px] font-[700] text-[#ff4b00] hover:bg-[#ff4b00]/[0.14]"
          >
            <FileDown size={16} />
            {t("orderConfirmationPage.downloadInvoice")}
          </Link>
        )}

        <div className="mt-[22px] flex w-full gap-[10px]">
          <Link
            href="/mine-bestillinger"
            className="flex-1 rounded-[10px] border border-white/15 px-[18px] py-[12px] text-center text-[13px] font-[700] text-white hover:bg-white/[0.06]"
          >
            {t("orderConfirmationPage.toMyOrders")}
          </Link>
          <Link
            href="/"
            className="flex-1 rounded-[10px] bg-[#ff4b00] px-[18px] py-[12px] text-center text-[13px] font-[800] uppercase tracking-[0.02em] text-white hover:brightness-110"
          >
            {t("orderConfirmationPage.toHomepage")}
          </Link>
        </div>
      </main>

      {pickerOpen && (
        <LocationPickerModal
          order={order}
          initialLocation={location}
          onClose={() => setPickerOpen(false)}
          onSaved={(saved) => setLocation(saved)}
        />
      )}
    </div>
  )
}

export default function OrderConfirmationPage() {
  return (
    <ProtectedRoute roles={["customer"]}>
      <OrderConfirmation />
    </ProtectedRoute>
  )
}
