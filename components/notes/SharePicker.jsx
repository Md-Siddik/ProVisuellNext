"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, Eye, Lock, PencilLine, Search } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { SHARE_ROLES } from "@/lib/notes/core"
import { fetchShareTargets } from "@/lib/notes/client"
import Sheet from "./Sheet"

export { ShareIcon } from "./sharing"

function Box({ checked }) {
  return (
    <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] border-2 ${checked ? "border-[#ff4b00] bg-[#ff4b00]" : "border-white/30"}`}>
      {checked && <Check size={14} strokeWidth={3} className="text-white" />}
    </span>
  )
}

const label = "mb-[8px] text-[12px] font-[700] uppercase tracking-[0.08em] text-white/40"

// Sharing settings for a note the viewer created: which roles and/or which
// people may see it, and whether they may edit the text. The server
// re-validates everything (recipients, permission to share) on save.
//   sharing  the note's current `sharing` from the API
//   onSave({ visibility, roles, userIds, allowEditing }) → Promise
export default function SharePicker({ sharing, onSave, onClose }) {
  const { t } = useTranslation()
  const [roles, setRoles] = useState(() => sharing?.roles || [])
  const [userIds, setUserIds] = useState(() => (sharing?.users || []).map((u) => u._id))
  const [allowEditing, setAllowEditing] = useState(Boolean(sharing?.allowEditing))
  const [targets, setTargets] = useState(null)
  const [targetsError, setTargetsError] = useState("")
  const [q, setQ] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const wasShared = sharing?.visibility === "shared"

  useEffect(() => {
    fetchShareTargets()
      .then(setTargets)
      .catch((err) => setTargetsError(err.message))
  }, [])

  const people = useMemo(() => {
    const all = targets?.users || []
    // People already chosen stay listed even if they've since lost access.
    const known = new Set(all.map((u) => u._id))
    const extra = (sharing?.users || []).filter((u) => !known.has(u._id))
    const list = [...all, ...extra]
    const term = q.trim().toLowerCase()
    const filtered = term ? list.filter((u) => `${u.name} ${u.email || ""}`.toLowerCase().includes(term)) : list
    return filtered.sort((a, b) => Number(userIds.includes(b._id)) - Number(userIds.includes(a._id)))
  }, [targets, sharing, q, userIds])

  const toggle = (list, setList, value) => setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value])
  const anyone = roles.length > 0 || userIds.length > 0

  const save = async (makePrivate = false) => {
    setBusy(true)
    setError("")
    try {
      await onSave(
        makePrivate || !anyone
          ? { visibility: "private", roles: [], userIds: [], allowEditing: false }
          : { visibility: "shared", roles, userIds, allowEditing }
      )
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Sheet title={t("notesPage.sharingSettings")} onClose={onClose}>
      <p className={label}>{t("notesPage.shareWithRoles")}</p>
      <ul className="flex flex-col gap-[4px]">
        {SHARE_ROLES.map((r) => (
          <li key={r}>
            <button
              type="button"
              role="checkbox"
              aria-checked={roles.includes(r)}
              disabled={busy}
              onClick={() => toggle(roles, setRoles, r)}
              className="flex min-h-[50px] w-full items-center gap-[12px] rounded-[12px] bg-white/[0.04] px-[14px] text-left hover:bg-white/[0.08] disabled:opacity-50"
            >
              <Box checked={roles.includes(r)} />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-[700] text-white">{t(`notesPage.shareRole_${r}`)}</span>
                <span className="block text-[12px] text-white/45">{t("notesPage.shareRolePeople", { n: targets?.counts?.[r] ?? "…" })}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p className={`${label} mt-[18px]`}>{t("notesPage.sharePeople")}</p>
      {targetsError ? (
        <p className="text-[13px] text-red-300">{targetsError}</p>
      ) : !targets ? (
        <p className="text-[13px] text-white/40">{t("notesPage.loading")}</p>
      ) : people.length === 0 && !q ? (
        <p className="text-[13px] text-white/45">{t("notesPage.sharePeopleEmpty")}</p>
      ) : (
        <>
          <label className="relative mb-[6px] block">
            <span className="sr-only">{t("notesPage.sharePeopleSearch")}</span>
            <Search size={15} className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2 text-white/35" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("notesPage.sharePeopleSearch")}
              className="h-[40px] w-full rounded-[10px] bg-white/[0.06] pl-[34px] pr-[12px] text-[14px] text-white outline-none placeholder:text-white/35 focus:ring-1 focus:ring-[#ff4b00]/60"
            />
          </label>
          <ul className="flex max-h-[220px] flex-col gap-[2px] overflow-y-auto overscroll-contain">
            {people.length === 0 && <li className="px-[4px] py-[8px] text-[13px] text-white/45">{t("notesPage.noResults")}</li>}
            {people.map((u) => (
              <li key={u._id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={userIds.includes(u._id)}
                  disabled={busy}
                  onClick={() => toggle(userIds, setUserIds, u._id)}
                  className="flex min-h-[46px] w-full items-center gap-[12px] rounded-[10px] px-[10px] text-left hover:bg-white/[0.05] disabled:opacity-50"
                >
                  <Box checked={userIds.includes(u._id)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-[600] text-white">{u.name || u.email}</span>
                    <span className="block truncate text-[11.5px] text-white/40">
                      {u.role ? t(`roles.${u.role}`) : ""}
                      {u.email && u.email !== u.name ? ` · ${u.email}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className={`${label} mt-[18px]`}>{t("notesPage.sharePermission")}</p>
      <div role="radiogroup" aria-label={t("notesPage.sharePermission")} className="flex flex-col gap-[4px]">
        {[
          { value: false, icon: Eye, title: t("notesPage.shareViewOnly"), desc: t("notesPage.shareViewOnlyDesc") },
          { value: true, icon: PencilLine, title: t("notesPage.shareAllowEditing"), desc: t("notesPage.shareAllowEditingDesc") },
        ].map((o) => {
          const selected = allowEditing === o.value
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={busy || !anyone}
              onClick={() => setAllowEditing(o.value)}
              className={`flex min-h-[54px] w-full items-center gap-[12px] rounded-[12px] px-[14px] text-left transition-colors disabled:opacity-40 ${
                selected ? "bg-[#ff4b00]/12 ring-1 ring-[#ff4b00]/50" : "bg-white/[0.04] hover:bg-white/[0.08]"
              }`}
            >
              <o.icon size={17} className={selected ? "text-[#ff4b00]" : "text-white/50"} />
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-[700] text-white">{o.title}</span>
                <span className="block text-[12px] text-white/50">{o.desc}</span>
              </span>
            </button>
          )
        })}
      </div>

      <p className="mt-[12px] text-[12.5px] leading-[1.5] text-white/50">{anyone ? t("notesPage.shareHintNew") : t("notesPage.shareNothingSelected")}</p>
      {error && (
        <p role="alert" className="mt-[8px] text-[13px] text-red-400">
          {error}
        </p>
      )}

      <div className="mt-[16px] flex flex-col gap-[8px] sm:flex-row-reverse">
        <button
          type="button"
          onClick={() => save(false)}
          disabled={busy || (!anyone && !wasShared)}
          className="h-[48px] flex-1 rounded-[12px] bg-[#ff4b00] text-[15px] font-[800] text-white hover:bg-[#e64400] disabled:opacity-40"
        >
          {busy ? t("notesPage.saving") : anyone ? t("notesPage.shareSave") : t("notesPage.shareMakePrivate")}
        </button>
        {wasShared && anyone && (
          <button
            type="button"
            onClick={() => save(true)}
            disabled={busy}
            className="inline-flex h-[48px] flex-1 items-center justify-center gap-[8px] rounded-[12px] bg-white/[0.06] text-[15px] font-[700] text-white/80 hover:bg-white/[0.1] disabled:opacity-40"
          >
            <Lock size={15} /> {t("notesPage.shareMakePrivate")}
          </button>
        )}
      </div>
    </Sheet>
  )
}
