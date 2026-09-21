"use client"

import { useEffect, useState } from "react"
import { getLocale } from "@/lib/i18n/locale"
import { ExternalLink } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { ACCURACY_QUALITY_STYLE, getAccuracyQuality } from "@/lib/locationQuality"

const STATUS_STYLE = {
  pending: "border-[#8b5cf6] bg-[#8b5cf6]/[0.06] text-[#a78bfa]",
  approved: "border-[#ff6500] bg-[#ff6500]/[0.03] text-[#ff6500]",
  rejected: "border-[#e32920] bg-[#e32920]/[0.04] text-[#ff3d32]",
  completed: "border-[#24943c] bg-[#24943c]/[0.08] text-[#5bd470]",
}

function formatDate(value) {
  if (!value) return "–"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "–"
  return d.toLocaleDateString(getLocale(), { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatDateTime(value) {
  if (!value) return "–"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "–"
  return d.toLocaleString(getLocale(), { dateStyle: "medium", timeStyle: "short" })
}

function googleMapsSearchUrl(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

// No embedded map — just a clean list of what customers have shared, with a
// link straight into Google Maps for the actual navigating. Needs no map
// API key and no billing.
export default function Lokasjoner() {
  const { t } = useTranslation()
  const { role } = useAuth()
  const base = role === "owner" ? "/dashboard/owner" : "/dashboard/admin"

  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    api
      .get("/locations")
      .then((data) => !cancelled && setLocations(data.locations))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <h1 className="text-[22px] font-[800] tracking-[-0.02em] text-white">{t("locationsPage.title")}</h1>
      <p className="mt-[4px] text-[13.5px] text-white/50">{t("locationsPage.subtitle")}</p>

      {error && <p className="mt-[16px] rounded-[8px] bg-red-500/10 px-[12px] py-[8px] text-[13px] text-red-300">{error}</p>}

      <div className="mt-[20px] overflow-x-auto rounded-[14px] border border-white/[0.08] bg-[#111212]">
        <table className="w-full min-w-[900px] text-left text-[13.5px]">
          <thead>
            <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-[0.04em] text-white/40">
              <th className="px-[18px] py-[13px] font-[600]">{t("locationsPage.colCustomer")}</th>
              <th className="px-[18px] py-[13px] font-[600]">{t("locationsPage.colEmail")}</th>
              <th className="px-[18px] py-[13px] font-[600]">{t("locationsPage.colOrder")}</th>
              <th className="px-[18px] py-[13px] font-[600]">{t("locationsPage.colService")}</th>
              <th className="px-[18px] py-[13px] font-[600]">{t("locationsPage.colStatus")}</th>
              <th className="px-[18px] py-[13px] font-[600]">{t("locationsPage.colDeadline")}</th>
              <th className="px-[18px] py-[13px] font-[600]">{t("locationsPage.colSharedAt")}</th>
              <th className="px-[18px] py-[13px] font-[600]">{t("locationsPage.colAccuracy")}</th>
              <th className="px-[18px] py-[13px] font-[600]">{t("locationsPage.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="px-[18px] py-[24px] text-center text-white/40">
                  {t("locationsPage.loading")}
                </td>
              </tr>
            )}
            {!loading && locations.length === 0 && (
              <tr>
                <td colSpan={9} className="px-[18px] py-[24px] text-center text-white/40">
                  {t("locationsPage.empty")}
                </td>
              </tr>
            )}
            {locations.map((loc) => (
              <tr key={loc._id} className="border-b border-white/[0.06] last:border-0">
                <td className="px-[18px] py-[13px] font-[700] text-white">{loc.customerName}</td>
                <td className="px-[18px] py-[13px] text-white/70">{loc.customerEmail || "–"}</td>
                <td className="px-[18px] py-[13px] text-white/70">#{loc.order?.orderNumber || "–"}</td>
                <td className="px-[18px] py-[13px] text-white/70">{loc.order?.service || "–"}</td>
                <td className="px-[18px] py-[13px]">
                  {loc.order?.status && (
                    <span className={`rounded-[6px] border px-[8px] py-[2px] text-[10.5px] font-[800] ${STATUS_STYLE[loc.order.status]}`}>
                      {t(`status.${loc.order.status}`)}
                    </span>
                  )}
                </td>
                <td className="px-[18px] py-[13px] text-white/70">{formatDate(loc.order?.expectedDeliveryDate)}</td>
                <td className="px-[18px] py-[13px] text-white/70">{formatDateTime(loc.locatedAt || loc.updatedAt)}</td>
                <td className="px-[18px] py-[13px] text-white/70">
                  {Number.isFinite(loc.locationAccuracy) ? (
                    <>
                      ±{Math.round(loc.locationAccuracy)} m
                      {(() => {
                        const quality = getAccuracyQuality(loc.locationAccuracy)
                        return (
                          (quality === "low" || quality === "unreliable") && (
                            <span className={`ml-[6px] text-[11px] font-[700] ${ACCURACY_QUALITY_STYLE[quality]}`}>
                              {t(`locationPicker.quality_${quality}`)}
                            </span>
                          )
                        )
                      })()}
                    </>
                  ) : (
                    "–"
                  )}
                </td>
                <td className="px-[18px] py-[13px]">
                  <div className="flex flex-wrap items-center gap-[8px]">
                    <a
                      href={`${base}/ordreoversikt`}
                      className="rounded-[7px] border border-white/15 px-[10px] py-[6px] text-[11.5px] font-[700] text-white hover:bg-white/[0.06]"
                    >
                      {t("locationsPage.openOrderButton")}
                    </a>
                    <a
                      href={googleMapsSearchUrl(loc.lat, loc.lng)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-[6px] rounded-[7px] bg-[#ff4b00] px-[10px] py-[6px] text-[11.5px] font-[800] text-white hover:brightness-110"
                    >
                      <ExternalLink size={12} />
                      {t("locationsPage.openInGoogleMapsButton")}
                    </a>
                    {loc.googleMapsShareUrl && (
                      <a
                        href={loc.googleMapsShareUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-[6px] rounded-[7px] border border-white/15 px-[10px] py-[6px] text-[11.5px] font-[700] text-white hover:bg-white/[0.06]"
                      >
                        <ExternalLink size={12} />
                        {t("locationsPage.openSharedLinkButton")}
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}