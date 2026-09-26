"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Lock, RotateCcw, Save } from "lucide-react"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { useTimeFormat } from "@/context/TimeFormatContext"
import { PERMISSION_GROUPS } from "@/lib/permissions"
import { ConfirmDialog, Feedback, btn, card, permLabel, sectionLabel, useFeedback } from "./ui"

// Permission set per staff role. Everyone with a role gets its set (plus
// their own per-user overrides) on their very next request. The Super Admin
// column is always everything and can't be edited; neither can the
// access-control permissions, which stay with the Super Admin.

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x))

function Cell({ checked, locked, disabled, label, onToggle }) {
  if (locked) {
    return (
      <span className="inline-flex h-[28px] w-[28px] items-center justify-center text-white/25" title={label}>
        <Lock size={13} />
      </span>
    )
  }
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`inline-flex h-[28px] w-[28px] items-center justify-center rounded-[7px] border transition-colors disabled:opacity-40 ${
        checked ? "border-emerald-500/60 bg-emerald-600 text-white" : "border-white/20 text-transparent hover:border-white/40"
      }`}
    >
      <Check size={15} strokeWidth={3} />
    </button>
  )
}

export default function RolePermissions() {
  const { t } = useTranslation()
  const { formatInstantDateTime } = useTimeFormat()
  const [matrix, setMatrix] = useState(null)
  const [draft, setDraft] = useState({})
  const [loadError, setLoadError] = useState("")
  const [busy, setBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(null)
  const [mobileRole, setMobileRole] = useState("administrator")
  const fb = useFeedback()

  const accept = useCallback((m) => {
    setMatrix(m)
    setDraft(Object.fromEntries(m.roles.map((r) => [r.role, r.permissions])))
  }, [])

  useEffect(() => {
    api
      .get("/superadmin/roles")
      .then(accept)
      .catch((err) => setLoadError(err.message))
  }, [accept])

  const roles = useMemo(() => matrix?.roles || [], [matrix])
  const dirty = roles.filter((r) => !sameSet(draft[r.role] || [], r.permissions)).map((r) => r.role)
  const lockedFor = (r, key) => r.locked.includes(key)

  const toggle = (role, key) =>
    setDraft((prev) => {
      const list = prev[role] || []
      return { ...prev, [role]: list.includes(key) ? list.filter((k) => k !== key) : [...list, key] }
    })

  const save = async () => {
    setBusy(true)
    fb.clear()
    try {
      let latest = matrix
      for (const role of dirty) latest = await api.put("/superadmin/roles", { role, permissions: draft[role] })
      accept(latest)
      fb.success(t("permissionsUi.rolesSaved", { roles: dirty.map((r) => t(`roles.${r}`)).join(", ") }))
    } catch (err) {
      fb.error(t("permissionsUi.rolesSaveFailed", { error: err.message }))
      // Whatever did save is reflected; unsaved edits stay in the draft.
      api.get("/superadmin/roles").then((m) => setMatrix(m)).catch(() => {})
    } finally {
      setBusy(false)
    }
  }

  const reset = async (role) => {
    setBusy(true)
    try {
      accept(await api.put("/superadmin/roles", { role, reset: true }))
      fb.success(t("permissionsUi.roleResetOk", { role: t(`roles.${role}`) }))
    } catch (err) {
      fb.error(err.message)
    } finally {
      setBusy(false)
      setConfirmReset(null)
    }
  }

  if (loadError) return <p className="rounded-[8px] bg-red-500/10 px-[12px] py-[8px] text-[13px] text-red-300">{loadError}</p>
  if (!matrix) return <p className="text-[13px] text-white/40">{t("permissionsUi.loading")}</p>

  const actions = (
    <div className="flex flex-wrap items-center gap-[8px]">
      {dirty.length > 0 && <span className="text-[12px] font-[700] text-amber-300">{t("permissionsUi.unsavedRoles", { n: dirty.length })}</span>}
      <button type="button" className={btn} disabled={busy || !dirty.length} onClick={() => accept(matrix)}>
        {t("permissionsUi.discard")}
      </button>
      <button
        type="button"
        disabled={busy || !dirty.length}
        onClick={save}
        className="inline-flex items-center gap-[7px] rounded-[8px] bg-[#ff4b00] px-[14px] py-[8px] text-[12.5px] font-[800] text-white hover:brightness-110 disabled:opacity-40"
      >
        <Save size={14} /> {busy ? t("permissionsUi.working") : t("permissionsUi.saveChanges")}
      </button>
    </div>
  )

  const roleMeta = (r) => (
    <span className="block text-[10.5px] font-[500] normal-case tracking-normal text-white/40">
      {r.customized ? t("permissionsUi.roleCustomized", { when: r.updatedAt ? formatInstantDateTime(r.updatedAt) : "" }) : t("permissionsUi.roleUsingDefaults")}
    </span>
  )

  return (
    <div className="space-y-[14px]">
      <div className={`${card} flex flex-col gap-[12px] p-[16px] sm:flex-row sm:items-center sm:justify-between`}>
        <p className="max-w-[640px] text-[13px] leading-[1.5] text-white/55">{t("permissionsUi.rolesIntro")}</p>
        {actions}
      </div>
      <Feedback feedback={fb.feedback} onDone={fb.clear} />

      {/* Phones: one role at a time. */}
      <div className="md:hidden">
        <div role="tablist" aria-label={t("permissionsUi.role")} className="grid grid-cols-3 gap-[2px] rounded-[10px] bg-white/[0.05] p-[3px]">
          {roles.map((r) => (
            <button
              key={r.role}
              type="button"
              role="tab"
              aria-selected={mobileRole === r.role}
              onClick={() => setMobileRole(r.role)}
              className={`h-[36px] truncate rounded-[8px] px-[4px] text-[12.5px] font-[700] ${mobileRole === r.role ? "bg-white/[0.12] text-white" : "text-white/50"}`}
            >
              {t(`roles.${r.role}`)}
              {dirty.includes(r.role) && " •"}
            </button>
          ))}
        </div>
        {roles
          .filter((r) => r.role === mobileRole)
          .map((r) => (
            <div key={r.role} className={`${card} mt-[10px] p-[14px]`}>
              <div className="flex items-start justify-between gap-[10px]">
                <p className="text-[14px] font-[800] text-white">
                  {t(`roles.${r.role}`)}
                  {roleMeta(r)}
                </p>
                {r.customized && (
                  <button type="button" className={btn} disabled={busy} onClick={() => setConfirmReset(r.role)}>
                    <RotateCcw size={13} />
                  </button>
                )}
              </div>
              {PERMISSION_GROUPS.map((g) => (
                <section key={g.key} className="mt-[14px]" aria-label={t(`permissionsUi.group.${g.key}`)}>
                  <p className={sectionLabel}>{t(`permissionsUi.group.${g.key}`)}</p>
                  {g.permissions.map((key) => (
                    <div key={key} className="flex items-center justify-between gap-[10px] border-b border-white/[0.05] py-[8px] last:border-b-0">
                      <span className="min-w-0 text-[13px] text-white/85">{permLabel(t, key)}</span>
                      <Cell
                        checked={(draft[r.role] || []).includes(key)}
                        locked={lockedFor(r, key)}
                        disabled={busy}
                        label={`${t(`roles.${r.role}`)}: ${permLabel(t, key)}${lockedFor(r, key) ? ` (${t("permissionsUi.superAdminOnly")})` : ""}`}
                        onToggle={() => toggle(r.role, key)}
                      />
                    </div>
                  ))}
                </section>
              ))}
            </div>
          ))}
      </div>

      {/* Tablets and up: the full matrix. */}
      <div className={`${card} hidden overflow-x-auto md:block`}>
        <table className="w-full min-w-[680px] text-left text-[12.5px]">
          <thead className="sticky top-0 border-b border-white/[0.08] bg-[#111212] text-white/60">
            <tr>
              <th className="px-[14px] py-[10px] font-[700]">{t("permissionsUi.permission")}</th>
              <th className="w-[110px] px-[8px] py-[10px] text-center font-[700] text-amber-300">{t("roles.superadmin")}</th>
              {roles.map((r) => (
                <th key={r.role} className="w-[140px] px-[8px] py-[10px] text-center font-[700]">
                  <span className="text-white">{t(`roles.${r.role}`)}</span>
                  {dirty.includes(r.role) && <span className="text-amber-300"> •</span>}
                  {roleMeta(r)}
                  {r.customized && (
                    <button type="button" disabled={busy} onClick={() => setConfirmReset(r.role)} className="mt-[4px] inline-flex items-center gap-[4px] text-[10.5px] font-[700] text-[#ff9b6a] hover:underline disabled:opacity-40">
                      <RotateCcw size={11} /> {t("permissionsUi.resetRole")}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          {PERMISSION_GROUPS.map((g) => (
            <tbody key={g.key}>
              <tr>
                <th colSpan={2 + roles.length} className="bg-white/[0.03] px-[14px] py-[7px] text-[11px] font-[800] uppercase tracking-[0.1em] text-white/45">
                  {t(`permissionsUi.group.${g.key}`)}
                </th>
              </tr>
              {g.permissions.map((key) => (
                <tr key={key} className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02]">
                  <td className="px-[14px] py-[7px]">
                    <span className="block text-[13px] text-white/90">{permLabel(t, key)}</span>
                    <code className="text-[10.5px] text-white/35">{key}</code>
                  </td>
                  <td className="px-[8px] py-[7px] text-center">
                    <span className="inline-flex h-[28px] w-[28px] items-center justify-center rounded-[7px] bg-amber-400/15 text-amber-300" title={t("roles.superadmin")}>
                      <Check size={15} strokeWidth={3} />
                    </span>
                  </td>
                  {roles.map((r) => (
                    <td key={r.role} className="px-[8px] py-[7px] text-center">
                      <Cell
                        checked={(draft[r.role] || []).includes(key)}
                        locked={lockedFor(r, key)}
                        disabled={busy}
                        label={`${t(`roles.${r.role}`)}: ${permLabel(t, key)}${lockedFor(r, key) ? ` (${t("permissionsUi.superAdminOnly")})` : ""}`}
                        onToggle={() => toggle(r.role, key)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      {dirty.length > 0 && <div className={`${card} sticky bottom-[12px] z-[5] flex justify-end p-[10px] shadow-2xl md:hidden`}>{actions}</div>}

      {confirmReset && (
        <ConfirmDialog
          title={t("permissionsUi.resetRoleTitle")}
          body={t("permissionsUi.resetRoleBody", { role: t(`roles.${confirmReset}`) })}
          confirmLabel={t("permissionsUi.resetRole")}
          danger
          busy={busy}
          onConfirm={() => reset(confirmReset)}
          onCancel={() => setConfirmReset(null)}
        />
      )}
    </div>
  )
}
