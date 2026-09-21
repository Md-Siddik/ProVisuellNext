"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import QRCode from "qrcode"
import { CheckCircle2, Copy, MapPin, RotateCcw, TriangleAlert, X } from "lucide-react"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { getAccuracyQuality } from "@/lib/locationQuality"

// Desktop Wi-Fi/IP-based geolocation can be off by kilometers, while mobile
// GPS usually locks onto something much better within a few seconds — so a
// single getCurrentPosition() call isn't trustworthy. Instead this watches
// for a short window and keeps the most accurate reading it sees, stopping
// early the moment a genuinely good fix arrives.
const COLLECTION_WINDOW_MS = 12000
const EARLY_STOP_ACCURACY_M = 30
const GEO_OPTIONS = { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

const QUALITY_STYLE = {
  high: { badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", dot: "bg-emerald-400" },
  acceptable: { badge: "border-sky-500/30 bg-sky-500/10 text-sky-300", dot: "bg-sky-400" },
  low: { badge: "border-amber-500/30 bg-amber-500/10 text-amber-300", dot: "bg-amber-400" },
  unreliable: { badge: "border-red-500/30 bg-red-500/10 text-red-300", dot: "bg-red-400" },
}

// Opening this modal IS the "click" that requests geolocation — no extra
// button inside it — so sharing a location is button-click, browser
// permission prompt, confirm: as close to one-click as the browser's own
// permission flow allows.
export default function LocationPickerModal({ order, initialLocation, onClose, onSaved }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState("collecting") // collecting | found | error
  const [best, setBest] = useState(null) // { lat, lng, accuracy, timestamp }
  const [mapsLink, setMapsLink] = useState(initialLocation?.googleMapsShareUrl || "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [qrDataUrl, setQrDataUrl] = useState("")
  const [linkCopied, setLinkCopied] = useState(false)

  const watchIdRef = useRef(null)
  const windowTimeoutRef = useRef(null)
  const bestRef = useRef(null)

  const stopWatching = () => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (windowTimeoutRef.current) {
      clearTimeout(windowTimeoutRef.current)
      windowTimeoutRef.current = null
    }
  }

  const finishCollecting = useCallback(() => {
    stopWatching()
    if (bestRef.current) {
      setStatus("found")
    } else {
      setStatus("error")
      setError(t("locationPicker.geolocationDenied"))
    }
  }, [t])

  const startCollecting = useCallback(() => {
    setStatus("collecting")
    setError("")
    setBest(null)
    bestRef.current = null
    setLinkCopied(false)

    if (!navigator.geolocation) {
      setStatus("error")
      setError(t("locationPicker.geolocationUnsupported"))
      return
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const reading = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        }
        if (!bestRef.current || reading.accuracy < bestRef.current.accuracy) {
          bestRef.current = reading
          setBest(reading)
        }
        if (reading.accuracy <= EARLY_STOP_ACCURACY_M) {
          finishCollecting()
        }
      },
      (err) => {
        // A single transient error (POSITION_UNAVAILABLE/TIMEOUT) shouldn't
        // abort a collection that already has a reading, or one that still
        // has time left on its window — only a hard permission denial ends
        // it immediately.
        if (err.code === err.PERMISSION_DENIED) {
          stopWatching()
          setStatus("error")
          setError(t("locationPicker.geolocationDenied"))
        }
      },
      GEO_OPTIONS
    )

    windowTimeoutRef.current = setTimeout(finishCollecting, COLLECTION_WINDOW_MS)
  }, [t, finishCollecting])

  useEffect(() => {
    startCollecting()
    return () => stopWatching()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const quality = best ? getAccuracyQuality(best.accuracy) : null
  const isUnreliable = quality === "unreliable"
  const showMobileFallback = status === "found" && (quality === "low" || quality === "unreliable") && !isMobileDevice()

  useEffect(() => {
    if (!showMobileFallback) {
      setQrDataUrl("")
      return
    }
    const url = `${window.location.origin}/mine-bestillinger/${order._id}#service-location`
    let cancelled = false
    QRCode.toDataURL(url, { margin: 1, width: 176, color: { dark: "#0a0a0a", light: "#f4f3f0" } })
      .then((dataUrl) => !cancelled && setQrDataUrl(dataUrl))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [showMobileFallback, order._id])

  const mobileLink = `${window.location.origin}/mine-bestillinger/${order._id}#service-location`

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(mobileLink)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2500)
    } catch {
      // clipboard access can be blocked (permissions, insecure context) —
      // the link is still shown as selectable text, so this just no-ops
    }
  }

  const handleConfirm = async () => {
    if (!best || isUnreliable) return
    setSaving(true)
    setError("")
    try {
      const { location } = await api.put(`/locations/order/${order._id}`, {
        lat: best.lat,
        lng: best.lng,
        locationAccuracy: best.accuracy,
        locatedAt: new Date(best.timestamp).toISOString(),
        googleMapsShareUrl: mapsLink.trim(),
      })
      onSaved(location)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-[16px]" onClick={onClose}>
      <div
        className="w-full max-w-[440px] rounded-[16px] border border-white/10 bg-[#111212] p-[24px] text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-[16px] flex items-center justify-between">
          <div className="flex items-center gap-[10px]">
            <MapPin size={18} className="text-[#ff4b00]" />
            <h2 className="text-[18px] font-[800] text-white">{t("locationPicker.sectionTitle")}</h2>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {status === "collecting" && (
          <div className="flex flex-col items-center gap-[12px] py-[20px] text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#ff4b00]" />
            <p className="text-[13px] text-white/60">{t("locationPicker.collectingLocation")}</p>
            {best && Number.isFinite(best.accuracy) && (
              <p className="text-[12px] text-white/40">
                {t("locationPicker.bestAccuracySoFar", { n: Math.round(best.accuracy) })}
              </p>
            )}
          </div>
        )}

        {status === "error" && (
          <div className="text-center">
            <p className="rounded-[10px] border border-red-500/30 bg-red-500/10 px-[14px] py-[10px] text-[13px] text-red-300">{error}</p>
            <button
              type="button"
              onClick={startCollecting}
              className="mt-[14px] inline-flex items-center gap-[7px] rounded-[9px] border border-white/15 px-[16px] py-[9px] text-[12.5px] font-[700] text-white hover:bg-white/[0.06]"
            >
              <RotateCcw size={13} />
              {t("locationPicker.retryButton")}
            </button>
          </div>
        )}

        {status === "found" && best && (
          <>
            <div className={`flex items-center gap-[10px] rounded-[10px] border px-[14px] py-[12px] ${QUALITY_STYLE[quality].badge}`}>
              <CheckCircle2 size={18} className="shrink-0" />
              <div>
                <p className="text-[13px] font-[700]">{t("locationPicker.locationFound")}</p>
                <p className="mt-[2px] text-[12.5px] opacity-90">
                  {t("locationPicker.accuracyValue", { n: Math.round(best.accuracy) })}
                </p>
              </div>
            </div>

            <p className="mt-[8px] flex items-center gap-[6px] text-[11.5px] text-white/50">
              <span className={`h-[7px] w-[7px] rounded-full ${QUALITY_STYLE[quality].dot}`} />
              {t(`locationPicker.quality_${quality}`)}
              <span className="text-white/30">·</span>
              {best.lat.toFixed(5)}, {best.lng.toFixed(5)}
            </p>

            {isUnreliable && (
              <div className="mt-[12px] flex items-start gap-[9px] rounded-[10px] border border-red-500/30 bg-red-500/10 px-[14px] py-[11px]">
                <TriangleAlert size={16} className="mt-[1px] shrink-0 text-red-400" />
                <p className="text-[12.5px] leading-[1.4] text-red-300">{t("locationPicker.unreliableWarning")}</p>
              </div>
            )}

            <button
              type="button"
              onClick={startCollecting}
              className="mt-[10px] inline-flex items-center gap-[6px] text-[12px] font-[700] text-[#ff4b00] hover:underline"
            >
              <RotateCcw size={12} />
              {t("locationPicker.retryButton")}
            </button>

            {showMobileFallback && (
              <div className="mt-[14px] rounded-[10px] border border-white/10 bg-white/[0.03] p-[14px]">
                <p className="text-[12.5px] font-[700] text-white">{t("locationPicker.mobileFallbackTitle")}</p>
                <p className="mt-[3px] text-[11.5px] leading-[1.4] text-white/55">{t("locationPicker.mobileFallbackDescription")}</p>
                <div className="mt-[10px] flex items-center gap-[12px]">
                  {qrDataUrl && (
                    <img src={qrDataUrl} alt="" width={88} height={88} className="shrink-0 rounded-[8px] border border-white/10" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] text-white/50">{mobileLink}</p>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="mt-[6px] inline-flex items-center gap-[6px] rounded-[7px] border border-white/15 px-[10px] py-[5px] text-[11px] font-[700] text-white hover:bg-white/[0.06]"
                    >
                      <Copy size={11} />
                      {linkCopied ? t("locationPicker.linkCopied") : t("locationPicker.copyLinkButton")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-[14px]">
              <label className="mb-[5px] block text-[11px] font-[600] text-white/60">{t("locationPicker.googleMapsLinkLabel")}</label>
              <input
                value={mapsLink}
                onChange={(e) => setMapsLink(e.target.value)}
                placeholder={t("locationPicker.googleMapsLinkPlaceholder")}
                className="w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[10px] py-[8px] text-[12.5px] text-white outline-none focus:border-[#ff4b00]"
              />
            </div>

            {error && <p className="mt-[10px] text-[12.5px] text-red-300">{error}</p>}

            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving || isUnreliable}
              title={isUnreliable ? t("locationPicker.unreliableWarning") : undefined}
              className="mt-[16px] w-full rounded-[10px] bg-[#ff4b00] py-[12px] text-[13px] font-[800] uppercase tracking-[0.02em] text-white hover:brightness-110 disabled:opacity-40"
            >
              {saving ? t("locationPicker.savingButton") : t("locationPicker.confirmButton")}
            </button>
          </>
        )}
      </div>
    </div>
  )
}