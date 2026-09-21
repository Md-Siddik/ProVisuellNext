"use client"

import { useState } from "react"
import { getLocale } from "@/lib/i18n/locale"

export function formatDate(iso, options = { day: "numeric", month: "long", year: "numeric" }) {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString(getLocale(), options)
}

export function initialsOf(name) {
  return (
    String(name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  )
}

// Photo when there is one (and it loads), otherwise initials.
export function Avatar({ name, src, size = 32 }) {
  const [failed, setFailed] = useState(false)
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        style={style}
        className="shrink-0 rounded-full object-cover"
      />
    )
  }
  return (
    <span
      style={style}
      className="flex shrink-0 items-center justify-center rounded-full bg-[#ff4b00]/15 font-[700] text-[#ff4b00]"
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  )
}

// A branded stand-in for posts without a cover image.
export function CoverFallback({ title, className = "" }) {
  return (
    <div
      className={`flex items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(255,75,0,0.22),transparent_60%),#141515] ${className}`}
      aria-hidden="true"
    >
      <span className="select-none px-[20px] text-center text-[clamp(20px,4vw,34px)] font-[800] leading-tight tracking-[-0.02em] text-white/20">
        {String(title || "").slice(0, 40)}
      </span>
    </div>
  )
}

// A YouTube / Vimeo page link → its privacy-friendly embed URL (or null).
export function toEmbedUrl(url) {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, "")
    if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v") || (u.pathname.startsWith("/embed/") ? u.pathname.split("/")[2] : "")
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null
    }
    if (host === "youtube-nocookie.com" && u.pathname.startsWith("/embed/")) return u.toString()
    if (host === "vimeo.com") return /^\/\d+/.test(u.pathname) ? `https://player.vimeo.com/video/${u.pathname.split("/")[1]}` : null
    if (host === "player.vimeo.com") return u.toString()
    return null
  } catch {
    return null
  }
}
