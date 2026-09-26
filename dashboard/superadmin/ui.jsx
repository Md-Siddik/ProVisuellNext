"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Ban, CheckCircle2, ShieldCheck, XCircle } from "lucide-react"
import { useTranslation } from "@/lib/i18n"

// Shared pieces of the Super Admin control center.

export const card = "rounded-[14px] border border-white/[0.08] bg-[#111212]"
export const btn =
  "inline-flex items-center justify-center gap-[7px] rounded-[8px] border border-white/15 px-[12px] py-[8px] text-[12.5px] font-[700] text-white/80 transition-colors hover:bg-white/[0.06] disabled:opacity-40"
export const sectionLabel = "text-[11px] font-[800] uppercase tracking-[0.1em] text-white/40"

const ROLE_STYLE = {
  administrator: "border-[#ff4b00]/50 text-[#ff9b6a]",
  owner: "border-violet-500/50 text-violet-300",
  moderator: "border-sky-500/50 text-sky-300",
  customer: "border-white/20 text-white/60",
}

export const permLabel = (t, key) => t(`permissionsUi.perm.${key.replace(".", "_")}`)

export function RoleBadge({ role, superAdmin }) {
  const { t } = useTranslation()
  if (superAdmin) {
    return (
      <span className="inline-flex items-center gap-[4px] rounded-[5px] border border-amber-400/60 px-[7px] py-[2px] text-[10.5px] font-[800] uppercase text-amber-300">
        <ShieldCheck size={11} /> {t("roles.superadmin")}
      </span>
    )
  }
  return <span className={`rounded-[5px] border px-[7px] py-[2px] text-[10.5px] font-[800] uppercase ${ROLE_STYLE[role] || ROLE_STYLE.customer}`}>{t(`roles.${role}`)}</span>
}

export function StatusBadge({ status }) {
  const { t } = useTranslation()
  if (status !== "banned") return null
  return (
    <span className="inline-flex items-center gap-[4px] rounded-[5px] border border-red-500/50 bg-red-500/10 px-[7px] py-[2px] text-[10.5px] font-[800] uppercase text-red-300">
      <Ban size={11} /> {t("permissionsUi.statusBanned")}
    </span>
  )
}

// Confirmation for anything consequential. `children` adds extra inputs
// (a reason, a typed confirmation); `canConfirm` gates the confirm button.
export function ConfirmDialog({ title, body, confirmLabel, danger, busy = false, canConfirm = true, onConfirm, onCancel, children }) {
  const { t } = useTranslation()
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onCancel()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [busy, onCancel])
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-[16px]" onClick={() => !busy && onCancel()}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="sa-confirm-title" className={`${card} w-full max-w-[440px] p-[22px]`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-[12px]">
          <span className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full ${danger ? "bg-red-500/15 text-red-300" : "bg-[#ff4b00]/15 text-[#ff4b00]"}`}>
            <AlertTriangle size={18} />
          </span>
          <div className="min-w-0">
            <h2 id="sa-confirm-title" className="text-[16px] font-[800] text-white">{title}</h2>
            <p className="mt-[6px] text-[13px] leading-[1.55] text-white/60">{body}</p>
          </div>
        </div>
        {children && <div className="mt-[16px]">{children}</div>}
        <div className="mt-[20px] flex flex-col-reverse gap-[8px] sm:flex-row sm:justify-end">
          <button type="button" className={btn} onClick={onCancel} disabled={busy} autoFocus>
            {t("permissionsUi.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || !canConfirm}
            className={`inline-flex items-center justify-center rounded-[8px] px-[14px] py-[8px] text-[12.5px] font-[800] text-white disabled:opacity-40 ${danger ? "bg-red-600 hover:bg-red-500" : "bg-[#ff4b00] hover:brightness-110"}`}
          >
            {busy ? t("permissionsUi.working") : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// Success / error line that clears itself after a few seconds.
export function Feedback({ feedback, onDone }) {
  useEffect(() => {
    if (!feedback || feedback.kind === "error") return
    const timer = setTimeout(onDone, 4000)
    return () => clearTimeout(timer)
  }, [feedback, onDone])
  if (!feedback) return null
  const ok = feedback.kind === "success"
  return (
    <p
      role={ok ? "status" : "alert"}
      className={`flex items-start gap-[8px] rounded-[8px] px-[12px] py-[8px] text-[13px] ${ok ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}
    >
      {ok ? <CheckCircle2 size={15} className="mt-[1px] shrink-0" /> : <XCircle size={15} className="mt-[1px] shrink-0" />}
      <span className="min-w-0">{feedback.message}</span>
    </p>
  )
}

export function useFeedback() {
  const [feedback, setFeedback] = useState(null)
  const actions = useMemo(
    () => ({
      success: (message) => setFeedback({ kind: "success", message, id: Date.now() }),
      error: (message) => setFeedback({ kind: "error", message, id: Date.now() }),
      clear: () => setFeedback(null),
    }),
    []
  )
  return { feedback, ...actions }
}
