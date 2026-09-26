"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { History, KeyRound, Lock, RotateCcw, Search, ShieldCheck, UserCog, Users } from "lucide-react"
import { api } from "@/lib/api"
import { useAuth } from "@/context/AuthContext"
import { useTranslation } from "@/lib/i18n"
import { useTimeFormat } from "@/context/TimeFormatContext"
import { ASSIGNABLE_ROLES, NON_GRANTABLE, PERMISSION_GROUPS, ROLE_LOCKED } from "@/lib/permissions"
import AccountStatusPanel from "@/dashboard/superadmin/AccountStatusPanel"
import RolePermissions from "@/dashboard/superadmin/RolePermissions"
import { ConfirmDialog, Feedback, RoleBadge, StatusBadge, btn, card, permLabel, useFeedback } from "@/dashboard/superadmin/ui"

// Private control center for the protected Super Admin: users (role,
// per-user overrides, ban / unban / delete), role permission sets and the
// audit log. The page is hidden from everyone else, and every
// /api/superadmin route re-checks the Super Admin identity server-side —
// this UI grants nothing by itself.

const PRIVILEGED = ["administrator", "owner", "moderator"]

// Three-state control: follow the role default, explicitly allow, explicitly deny.
function PermissionRow({ perm, locked, busy, onChange }) {
  const { t } = useTranslation()
  const states = [
    { id: "inherit", label: t("permissionsUi.inherit") },
    { id: "grant", label: t("permissionsUi.allow") },
    { id: "deny", label: t("permissionsUi.deny") },
  ]
  const current = perm.state === "granted" ? "grant" : perm.state === "denied" ? "deny" : "inherit"
  return (
    <div className="flex flex-wrap items-center justify-between gap-[10px] border-b border-white/[0.05] py-[9px] last:border-b-0">
      <div className="min-w-0">
        <p className="text-[13px] font-[600] text-white">{permLabel(t, perm.key)}</p>
        <p className="text-[11px] text-white/40">
          <code className="text-white/45">{perm.key}</code> · {t("permissionsUi.roleDefault")}: {perm.inherited ? t("permissionsUi.on") : t("permissionsUi.off")}
        </p>
      </div>
      <div className="flex items-center gap-[10px]">
        {locked ? (
          <span className="inline-flex items-center gap-[5px] text-[11.5px] text-white/40">
            <Lock size={12} /> {t("permissionsUi.superAdminOnly")}
          </span>
        ) : (
          <div role="radiogroup" aria-label={permLabel(t, perm.key)} className="inline-flex rounded-[8px] border border-white/15 p-[2px]">
            {states.map((s) => {
              const active = current === s.id
              const tone = s.id === "grant" ? "bg-emerald-600 text-white" : s.id === "deny" ? "bg-red-600 text-white" : "bg-white/15 text-white"
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={busy}
                  onClick={() => !active && onChange(perm.key, s.id)}
                  className={`rounded-[6px] px-[9px] py-[4px] text-[11px] font-[700] transition-colors disabled:opacity-50 ${active ? tone : "text-white/55 hover:text-white"}`}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        )}
        <span
          className={`min-w-[74px] rounded-[5px] border px-[7px] py-[3px] text-center text-[10.5px] font-[800] uppercase ${
            perm.effective ? "border-emerald-500/40 text-emerald-300" : "border-white/15 text-white/40"
          }`}
        >
          {perm.effective ? t("permissionsUi.allowed") : t("permissionsUi.blocked")}
        </span>
      </div>
    </div>
  )
}

function UserDetail({ user, isSelf, onUpdated, onDeleted }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const fb = useFeedback()

  const patch = async (body) => {
    setBusy(true)
    fb.clear()
    try {
      const { user: updated } = await api.patch(`/superadmin/users/${user._id}`, body)
      onUpdated(updated)
      fb.success(t("permissionsUi.savedOk"))
    } catch (err) {
      fb.error(err.message)
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  const askRole = (role) => {
    const removing = PRIVILEGED.includes(user.role) && role !== user.role
    setConfirm({
      title: t("permissionsUi.confirmRoleTitle"),
      body: t("permissionsUi.confirmRoleBody", { name: user.name || user.email, from: t(`roles.${user.role}`), to: t(`roles.${role}`) }),
      confirmLabel: t("permissionsUi.changeRole"),
      danger: removing,
      run: () => patch({ role }),
    })
  }

  const byKey = useMemo(() => new Map(user.permissions.map((p) => [p.key, p])), [user])
  const overrides = user.grants.length + user.denies.length

  if (user.isSuperAdmin || isSelf) {
    return (
      <div className={`${card} p-[22px]`}>
        <div className="flex items-center gap-[10px]">
          <ShieldCheck size={20} className="text-amber-300" />
          <h2 className="text-[17px] font-[800] text-white">{user.name || user.email}</h2>
        </div>
        <p className="mt-[8px] text-[13px] text-white/55">{t("permissionsUi.superAdminProtected")}</p>
      </div>
    )
  }

  return (
    <div className="space-y-[14px]">
      <div className={`${card} p-[18px]`}>
        <div className="flex flex-wrap items-start justify-between gap-[10px]">
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-[800] text-white">{user.name || user.email}</h2>
            <p className="truncate text-[12.5px] text-white/50">{user.email}</p>
          </div>
          <span className="flex flex-wrap gap-[6px]">
            <StatusBadge status={user.status} />
            <RoleBadge role={user.role} />
          </span>
        </div>

        <div className="mt-[12px]">
          <Feedback feedback={fb.feedback} onDone={fb.clear} />
        </div>

        <p className="mb-[8px] mt-[16px] text-[11px] font-[800] uppercase tracking-[0.1em] text-white/40">{t("permissionsUi.role")}</p>
        <div className="flex flex-wrap gap-[6px]">
          {ASSIGNABLE_ROLES.map((role) => (
            <button
              key={role}
              type="button"
              disabled={busy || role === user.role}
              onClick={() => askRole(role)}
              className={`rounded-[8px] border px-[12px] py-[7px] text-[12.5px] font-[700] transition-colors ${
                role === user.role ? "border-[#ff4b00] bg-[#ff4b00]/12 text-[#ff9b6a]" : "border-white/15 text-white/70 hover:bg-white/[0.06]"
              }`}
            >
              {t(`roles.${role}`)}
            </button>
          ))}
        </div>

        <div className="mt-[16px] grid grid-cols-2 gap-[8px] sm:grid-cols-3 lg:grid-cols-5">
          {PERMISSION_GROUPS.map((g) => {
            const on = g.permissions.filter((k) => byKey.get(k)?.effective).length
            return (
              <div key={g.key} className="rounded-[8px] border border-white/[0.07] px-[10px] py-[7px]">
                <p className="text-[11px] text-white/45">{t(`permissionsUi.group.${g.key}`)}</p>
                <p className="text-[14px] font-[800] tabular-nums text-white">
                  {on}/{g.permissions.length}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      <AccountStatusPanel user={user} onUpdated={onUpdated} onDeleted={onDeleted} onFeedback={fb} />

      <div className={`${card} p-[18px]`}>
        <div className="flex flex-wrap items-center justify-between gap-[10px]">
          <div>
            <h3 className="text-[15px] font-[800] text-white">{t("permissionsUi.permissions")}</h3>
            <p className="text-[12px] text-white/45">{t("permissionsUi.permissionsHint", { n: overrides })}</p>
          </div>
          <button
            type="button"
            className={btn}
            disabled={busy || overrides === 0}
            onClick={() =>
              setConfirm({
                title: t("permissionsUi.resetTitle"),
                body: t("permissionsUi.resetBody", { name: user.name || user.email }),
                confirmLabel: t("permissionsUi.reset"),
                danger: true,
                run: () => patch({ reset: true }),
              })
            }
          >
            <RotateCcw size={14} /> {t("permissionsUi.reset")}
          </button>
        </div>
        <div className="mt-[10px] space-y-[16px]">
          {PERMISSION_GROUPS.map((g) => (
            <section key={g.key} aria-label={t(`permissionsUi.group.${g.key}`)}>
              <p className="mb-[2px] text-[11px] font-[800] uppercase tracking-[0.1em] text-white/40">{t(`permissionsUi.group.${g.key}`)}</p>
              {g.permissions.map((k) => (
                <PermissionRow key={k} perm={byKey.get(k)} locked={NON_GRANTABLE.includes(k) || Boolean(ROLE_LOCKED[k] && !ROLE_LOCKED[k].includes(user.role) && !byKey.get(k)?.inherited)} busy={busy} onChange={(permission, state) => patch({ permission, state })} />
              ))}
            </section>
          ))}
        </div>
      </div>

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onConfirm={confirm.run}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

function AuditDetail({ entry: e }) {
  const { t } = useTranslation()
  if (e.permission) return permLabel(t, e.permission)
  if (e.added || e.removed) {
    const list = (keys, sign) => (keys || []).map((k) => `${sign} ${permLabel(t, k)}`)
    return <span className="break-words">{[...list(e.added, "+"), ...list(e.removed, "−")].join(", ") || "—"}</span>
  }
  if (e.action === "USER_BANNED") return e.detail ? t("permissionsUi.banReasonShown", { reason: e.detail }) : "—"
  if (e.newRole && e.oldRole !== e.newRole) return `${t(`roles.${e.oldRole}`)} → ${t(`roles.${e.newRole}`)}`
  return "—"
}

function AuditLog({ targetId, refreshKey }) {
  const { t } = useTranslation()
  const { formatInstantDateTime } = useTimeFormat()
  const [data, setData] = useState(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    api
      .get(`/superadmin/audit${targetId ? `?target=${targetId}` : ""}`)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [targetId, refreshKey])

  if (error) return <p className="text-[13px] text-red-300">{error}</p>
  if (!data) return <p className="text-[13px] text-white/40">{t("permissionsUi.loading")}</p>
  if (data.entries.length === 0) return <p className={`${card} p-[18px] text-center text-[13px] text-white/45`}>{t("permissionsUi.noAudit")}</p>

  return (
    <div className={`${card} overflow-x-auto`}>
      <table className="w-full min-w-[640px] text-left text-[12.5px]">
        <thead className="border-b border-white/[0.08] text-white/45">
          <tr>
            <th className="px-[14px] py-[10px] font-[600]">{t("permissionsUi.auditTime")}</th>
            <th className="px-[14px] py-[10px] font-[600]">{t("permissionsUi.auditAction")}</th>
            <th className="px-[14px] py-[10px] font-[600]">{t("permissionsUi.auditTarget")}</th>
            <th className="px-[14px] py-[10px] font-[600]">{t("permissionsUi.auditDetail")}</th>
            <th className="px-[14px] py-[10px] font-[600]">{t("permissionsUi.auditActor")}</th>
          </tr>
        </thead>
        <tbody>
          {data.entries.map((e) => (
            <tr key={e._id} className="border-b border-white/[0.05] last:border-b-0">
              <td className="whitespace-nowrap px-[14px] py-[9px] tabular-nums text-white/60">{formatInstantDateTime(e.createdAt)}</td>
              <td className="px-[14px] py-[9px]">
                <code className="rounded-[4px] bg-white/[0.06] px-[6px] py-[2px] text-[11px] text-white/85">{e.action}</code>
              </td>
              <td className="px-[14px] py-[9px] text-white/80">{e.role ? t(`roles.${e.role}`) : e.targetName || e.targetEmail}</td>
              <td className="max-w-[360px] px-[14px] py-[9px] text-white/60">
                <AuditDetail entry={e} />
              </td>
              <td className="px-[14px] py-[9px] text-white/50">{e.actorEmail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function SuperAdmin() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [tab, setTab] = useState("users")
  const [search, setSearch] = useState("")
  const [role, setRole] = useState("")
  const [status, setStatus] = useState("")
  const [list, setList] = useState(null)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState(null)
  const [auditKey, setAuditKey] = useState(0)
  const listFeedback = useFeedback()

  const load = useCallback(async () => {
    try {
      const qs = new URLSearchParams()
      if (search.trim()) qs.set("search", search.trim())
      if (role) qs.set("role", role)
      if (status) qs.set("status", status)
      setList(await api.get(`/superadmin/users?${qs}`))
      setError("")
    } catch (err) {
      setError(err.message)
    }
  }, [search, role, status])

  useEffect(() => {
    const timer = setTimeout(load, 250)
    return () => clearTimeout(timer)
  }, [load])

  const onUpdated = (updated) => {
    setSelected(updated)
    setList((prev) => prev && { ...prev, users: prev.users.map((u) => (u._id === updated._id ? updated : u)) })
    setAuditKey((k) => k + 1)
  }

  const onDeleted = (id) => {
    const gone = selected?._id === id ? selected : null
    setSelected(null)
    setList((prev) => prev && { ...prev, users: prev.users.filter((u) => u._id !== id), total: Math.max(0, prev.total - 1) })
    setAuditKey((k) => k + 1)
    listFeedback.success(t("permissionsUi.deletedOk", { name: gone?.name || gone?.email || "" }))
  }

  const tabs = [
    { id: "users", icon: Users, label: t("permissionsUi.tabUsers") },
    { id: "roles", icon: KeyRound, label: t("permissionsUi.tabRoles") },
    { id: "audit", icon: History, label: t("permissionsUi.tabAudit") },
  ]
  const select = "h-[38px] rounded-[10px] border border-white/15 bg-white/[0.03] px-[10px] text-[12.5px] text-white"

  return (
    <div>
      <div className="flex flex-col gap-[6px]">
        <h1 className="flex items-center gap-[10px] text-[22px] font-[800] tracking-[-0.02em] text-white sm:text-[26px]">
          <ShieldCheck size={24} className="shrink-0 text-amber-300" />
          {t("permissionsUi.title")}
        </h1>
        <p className="max-w-[720px] text-[14px] text-white/50">{t("permissionsUi.subtitle")}</p>
      </div>

      <div className="mt-[18px] flex gap-[4px] overflow-x-auto border-b border-white/[0.08]" role="tablist">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={`-mb-px inline-flex shrink-0 items-center gap-[7px] border-b-2 px-[14px] py-[10px] text-[13px] font-[700] ${
              tab === x.id ? "border-[#ff4b00] text-white" : "border-transparent text-white/50 hover:text-white/80"
            }`}
          >
            <x.icon size={15} /> {x.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-[14px] rounded-[8px] bg-red-500/10 px-[12px] py-[8px] text-[13px] text-red-300">{error}</p>}

      {tab === "audit" && (
        <div className="mt-[18px]">
          <AuditLog refreshKey={auditKey} />
        </div>
      )}

      {tab === "roles" && (
        <div className="mt-[18px]">
          <RolePermissions />
        </div>
      )}

      {tab === "users" && (
        <div className="mt-[18px] grid gap-[16px] xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-[10px]">
            <label className="flex items-center gap-[8px] rounded-[10px] border border-white/15 bg-white/[0.03] px-[12px] focus-within:border-[#ff4b00]">
              <Search size={15} className="text-white/40" />
              <span className="sr-only">{t("permissionsUi.search")}</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("permissionsUi.search")}
                className="h-[38px] w-full bg-transparent text-[13px] text-white placeholder-white/35 outline-none"
              />
            </label>
            <div className="grid grid-cols-2 gap-[8px]">
              <select value={role} onChange={(e) => setRole(e.target.value)} aria-label={t("permissionsUi.role")} className={select}>
                <option value="" className="bg-[#111212]">{t("permissionsUi.allRoles")}</option>
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r} className="bg-[#111212]">
                    {t(`roles.${r}`)}
                  </option>
                ))}
              </select>
              <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t("permissionsUi.accountStatus")} className={select}>
                <option value="" className="bg-[#111212]">{t("permissionsUi.allStatuses")}</option>
                <option value="active" className="bg-[#111212]">{t("permissionsUi.statusActive")}</option>
                <option value="banned" className="bg-[#111212]">{t("permissionsUi.statusBanned")}</option>
              </select>
            </div>
            <Feedback feedback={listFeedback.feedback} onDone={listFeedback.clear} />
            <div className={`${card} max-h-[70vh] overflow-y-auto`}>
              {!list && <p className="p-[16px] text-[13px] text-white/40">{t("permissionsUi.loading")}</p>}
              {list?.users.length === 0 && <p className="p-[16px] text-[13px] text-white/45">{t("permissionsUi.noUsers")}</p>}
              {list?.users.map((u) => (
                <button
                  key={u._id}
                  type="button"
                  onClick={() => setSelected(u)}
                  aria-current={selected?._id === u._id ? "true" : undefined}
                  className={`flex w-full items-center justify-between gap-[10px] border-b border-white/[0.05] px-[14px] py-[11px] text-left last:border-b-0 ${
                    selected?._id === u._id ? "bg-[#ff4b00]/10" : "hover:bg-white/[0.03]"
                  }`}
                >
                  <span className="min-w-0">
                    <span className={`block truncate text-[13px] font-[700] ${u.status === "banned" ? "text-white/50 line-through" : "text-white"}`}>{u.name || u.email}</span>
                    <span className="block truncate text-[11.5px] text-white/45">{u.email}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-[4px]">
                    <RoleBadge role={u.role} superAdmin={u.isSuperAdmin} />
                    <StatusBadge status={u.status} />
                    {u.grants.length + u.denies.length > 0 && (
                      <span className="text-[10.5px] text-white/45">{t("permissionsUi.overrideCount", { n: u.grants.length + u.denies.length })}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
            {list && <p className="text-[11.5px] text-white/40">{t("permissionsUi.userCount", { n: list.total })}</p>}
          </div>

          <div className="min-w-0 space-y-[14px]">
            {selected ? (
              <>
                <UserDetail key={selected._id} user={selected} isSelf={String(profile?._id) === String(selected._id)} onUpdated={onUpdated} onDeleted={onDeleted} />
                <div>
                  <p className="mb-[8px] flex items-center gap-[7px] text-[13px] font-[800] text-white/80">
                    <History size={14} /> {t("permissionsUi.userHistory")}
                  </p>
                  <AuditLog targetId={selected._id} refreshKey={auditKey} />
                </div>
              </>
            ) : (
              <div className={`${card} flex flex-col items-center p-[36px] text-center`}>
                <UserCog size={28} className="text-white/30" />
                <p className="mt-[10px] text-[13px] text-white/50">{t("permissionsUi.pickUser")}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
