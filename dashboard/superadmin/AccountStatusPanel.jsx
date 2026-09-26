"use client"

import { useState } from "react"
import { Ban, RotateCcw, Trash2 } from "lucide-react"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { useTimeFormat } from "@/context/TimeFormatContext"
import { ConfirmDialog, btn, card, sectionLabel } from "./ui"

// Ban / unban / delete for one account. The server refuses all three for the
// Super Admin and for the caller's own account; this only asks first.
export default function AccountStatusPanel({ user, onUpdated, onDeleted, onFeedback }) {
  const { t } = useTranslation()
  const { formatInstantDateTime } = useTimeFormat()
  const [dialog, setDialog] = useState(null) // "ban" | "unban" | "delete"
  const [reason, setReason] = useState("")
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)
  const banned = user.status === "banned"
  const name = user.name || user.email

  const open = (kind) => {
    setReason("")
    setTyped("")
    setDialog(kind)
  }

  const run = async () => {
    setBusy(true)
    try {
      if (dialog === "delete") {
        await api.delete(`/superadmin/users/${user._id}`)
        onFeedback.success(t("permissionsUi.deletedOk", { name }))
        setDialog(null)
        onDeleted(user._id)
        return
      }
      const body = dialog === "ban" ? { status: "banned", reason: reason.trim() } : { status: "active" }
      const { user: updated } = await api.patch(`/superadmin/users/${user._id}`, body)
      onUpdated(updated)
      onFeedback.success(t(dialog === "ban" ? "permissionsUi.bannedOk" : "permissionsUi.unbannedOk", { name }))
      setDialog(null)
    } catch (err) {
      onFeedback.error(err.message)
      setDialog(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`${card} p-[18px]`}>
      <p className={sectionLabel}>{t("permissionsUi.accountStatus")}</p>
      <div className="mt-[10px] flex flex-wrap items-center justify-between gap-[12px]">
        <div className="min-w-0">
          <p className={`text-[14px] font-[800] ${banned ? "text-red-300" : "text-emerald-300"}`}>{banned ? t("permissionsUi.statusBanned") : t("permissionsUi.statusActive")}</p>
          {banned && (
            <p className="mt-[2px] text-[12px] text-white/50">
              {user.bannedAt && t("permissionsUi.bannedSince", { when: formatInstantDateTime(user.bannedAt) })}
              {user.banReason && <span className="block break-words">{t("permissionsUi.banReasonShown", { reason: user.banReason })}</span>}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-[8px]">
          {banned ? (
            <button type="button" className={btn} onClick={() => open("unban")}>
              <RotateCcw size={14} /> {t("permissionsUi.unban")}
            </button>
          ) : (
            <button type="button" className={`${btn} border-red-500/40 text-red-300 hover:bg-red-500/10`} onClick={() => open("ban")}>
              <Ban size={14} /> {t("permissionsUi.ban")}
            </button>
          )}
          <button
            type="button"
            className={`${btn} border-red-500/40 text-red-300 hover:bg-red-500/10`}
            onClick={() => open("delete")}
            disabled={banned}
            title={banned ? t("permissionsUi.deleteBannedHint") : undefined}
          >
            <Trash2 size={14} /> {t("permissionsUi.deleteUser")}
          </button>
        </div>
      </div>
      {banned && <p className="mt-[10px] text-[12px] text-white/45">{t("permissionsUi.deleteBannedHint")}</p>}

      {dialog === "ban" && (
        <ConfirmDialog
          title={t("permissionsUi.banTitle")}
          body={t("permissionsUi.banBody", { name })}
          confirmLabel={t("permissionsUi.ban")}
          danger
          busy={busy}
          onConfirm={run}
          onCancel={() => setDialog(null)}
        >
          <label className="block">
            <span className={sectionLabel}>{t("permissionsUi.banReason")}</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              rows={2}
              className="mt-[6px] w-full resize-none rounded-[8px] border border-white/15 bg-white/[0.03] px-[10px] py-[8px] text-[13px] text-white outline-none focus:border-[#ff4b00]"
            />
          </label>
        </ConfirmDialog>
      )}
      {dialog === "unban" && (
        <ConfirmDialog
          title={t("permissionsUi.unbanTitle")}
          body={t("permissionsUi.unbanBody", { name })}
          confirmLabel={t("permissionsUi.unban")}
          busy={busy}
          onConfirm={run}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog === "delete" && (
        <ConfirmDialog
          title={t("permissionsUi.deleteTitle")}
          body={t("permissionsUi.deleteBody", { name })}
          confirmLabel={t("permissionsUi.deleteUser")}
          danger
          busy={busy}
          canConfirm={typed.trim().toLowerCase() === String(user.email).toLowerCase()}
          onConfirm={run}
          onCancel={() => setDialog(null)}
        >
          <label className="block">
            <span className="text-[12px] text-white/55">{t("permissionsUi.deleteTypeEmail", { email: user.email })}</span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-label={t("permissionsUi.deleteTypeEmail", { email: user.email })}
              className="mt-[6px] h-[38px] w-full rounded-[8px] border border-white/15 bg-white/[0.03] px-[10px] text-[13px] text-white outline-none focus:border-red-500"
            />
          </label>
        </ConfirmDialog>
      )}
    </div>
  )
}
