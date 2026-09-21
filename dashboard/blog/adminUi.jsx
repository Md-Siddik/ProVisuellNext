"use client"

import { useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Clock, FileEdit, Archive } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/locale"

export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export const inputClass =
  "w-full rounded-[10px] border border-white/12 bg-white/[0.04] px-[12px] py-[9px] text-[13.5px] text-white placeholder-white/35 outline-none transition-colors focus:border-[#ff4b00]"

export const btnPrimary =
  "inline-flex items-center justify-center gap-[7px] rounded-[10px] bg-[#ff4b00] px-[16px] py-[9px] text-[12.5px] font-[800] uppercase tracking-[0.02em] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
export const btnGhost =
  "inline-flex items-center justify-center gap-[7px] rounded-[10px] border border-white/15 px-[14px] py-[9px] text-[12.5px] font-[700] text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
export const iconBtn =
  "flex h-[32px] w-[32px] items-center justify-center rounded-[8px] text-white/55 transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-[#ff4b00] disabled:opacity-40"

export function Card({ className = "", children }) {
  return <div className={`rounded-[14px] border border-white/[0.08] bg-[#111212] ${className}`}>{children}</div>
}

// Status is always shown as an icon plus a word, never colour alone.
const STATUS_STYLE = {
  published: { icon: CheckCircle2, cls: "border-emerald-500/40 text-emerald-400" },
  draft: { icon: FileEdit, cls: "border-white/25 text-white/65" },
  scheduled: { icon: Clock, cls: "border-sky-400/40 text-sky-300" },
  archived: { icon: Archive, cls: "border-amber-400/40 text-amber-300" },
  approved: { icon: CheckCircle2, cls: "border-emerald-500/40 text-emerald-400" },
  pending: { icon: Clock, cls: "border-amber-400/40 text-amber-300" },
  hidden: { icon: Archive, cls: "border-white/25 text-white/60" },
  spam: { icon: AlertCircle, cls: "border-red-500/40 text-red-400" },
}

export function StatusBadge({ status }) {
  const { t } = useTranslation()
  const s = STATUS_STYLE[status] || STATUS_STYLE.draft
  const Icon = s.icon
  return (
    <span className={`inline-flex items-center gap-[5px] rounded-full border px-[9px] py-[3px] text-[11px] font-[700] ${s.cls}`}>
      <Icon size={11} aria-hidden="true" />
      {t(`blogAdmin.status.${status}`)}
    </span>
  )
}

export function Pager({ page, pages, onPage }) {
  const { t } = useTranslation()
  if (pages <= 1) return null
  return (
    <div className="mt-[16px] flex items-center justify-between gap-[10px] text-[12.5px] text-white/50">
      <span>{t("blogAdmin.pageOf", { page, pages })}</span>
      <div className="flex gap-[6px]">
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label={t("blog.previous")} className={btnGhost + " !px-[10px]"}>
          <ChevronLeft size={15} />
        </button>
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label={t("blog.next")} className={btnGhost + " !px-[10px]"}>
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}

export function ErrorNote({ children, onRetry }) {
  const { t } = useTranslation()
  if (!children) return null
  return (
    <div role="alert" className="flex items-center justify-between gap-[10px] rounded-[10px] border border-red-500/25 bg-red-500/10 px-[12px] py-[9px] text-[12.5px] text-red-200">
      <span className="flex items-center gap-[7px]">
        <AlertCircle size={14} className="shrink-0" />
        {children}
      </span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="rounded-full border border-red-300/40 px-[10px] py-[2px] text-[11.5px] font-[700] hover:bg-red-500/15">
          {t("blog.retry")}
        </button>
      )}
    </div>
  )
}

export function Spinner({ className = "" }) {
  return <span className={`inline-block h-[16px] w-[16px] animate-spin rounded-full border-2 border-white/20 border-t-[#ff4b00] ${className}`} aria-hidden="true" />
}

export function LoadingBlock({ rows = 4 }) {
  return (
    <div className="space-y-[10px]" role="status" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-[52px] animate-pulse rounded-[10px] bg-white/[0.06]" />
      ))}
    </div>
  )
}

export function Empty({ children }) {
  return <p className="rounded-[12px] border border-dashed border-white/12 px-[16px] py-[28px] text-center text-[13px] text-white/45">{children}</p>
}

// A backend "already in use" style conflict, recognised from the raw message.
export function isConflict(err) {
  return /already (in use|exists)/i.test(err?.rawMessage || "")
}

export function fmtDate(iso, withTime = false) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(getLocale(), withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" })
}
