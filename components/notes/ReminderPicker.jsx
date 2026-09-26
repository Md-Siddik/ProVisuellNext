"use client"

import { useEffect, useState } from "react"
import { BellOff, CalendarClock, ChevronRight } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useTimeFormat } from "@/context/TimeFormatContext"
import { useTranslation } from "@/lib/i18n"
import { addDays, getNorwayNow, osloParts, osloToUtc } from "@/lib/appointments/time"
import { fetchAudience, quickReminderTimes } from "@/lib/notes/client"
import { SHARE_ROLES } from "@/lib/notes/core"
import Sheet from "./Sheet"

const field =
  "h-[46px] w-full rounded-[10px] border border-white/15 bg-white/[0.04] px-[12px] text-[15px] text-white outline-none [color-scheme:dark] focus:border-[#ff4b00]"
const REPEATS = ["none", "daily", "weekly", "monthly"]

// Who a reminder reaches, as one line: "Reminder will be sent to: me@x.no"
// or "Recipients: You + Owners (2) + 1 person". `sharing` is the note's
// sharing from the API.
export function useRecipientLine(sharing) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [audience, setAudience] = useState(null)
  const shared = sharing?.visibility === "shared"
  useEffect(() => {
    if (!shared || !sharing.roles.length) return
    let cancelled = false
    fetchAudience()
      .then((a) => !cancelled && setAudience(a))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [shared, sharing?.roles?.length])
  if (!shared) return t("notesPage.sentTo", { email: profile?.email || "" })
  const parts = [t("notesPage.you")]
  for (const role of SHARE_ROLES) if (sharing.roles.includes(role)) parts.push(t(`notesPage.audience_${role}`, { n: audience?.[role] ?? "…" }))
  const people = sharing.users?.length || 0
  if (people) parts.push(people === 1 ? t("notesPage.sharePeopleOne") : t("notesPage.sharePeopleMany", { n: people }))
  return t("notesPage.recipients", { list: parts.join(" + ") })
}

// Set, change or remove a reminder. onSave(reminder) → Promise.
export default function ReminderPicker({ reminder, sharing, onSave, onClose }) {
  const { t } = useTranslation()
  const { formatInstantDateTime, formatInstantTime } = useTimeFormat()
  const recipientLine = useRecipientLine(sharing)
  const current = reminder?.enabled && reminder.at ? osloParts(reminder.at) : null
  const today = getNorwayNow().date
  const [custom, setCustom] = useState(Boolean(current))
  const [date, setDate] = useState(current?.date || addDays(today, 1))
  const [time, setTime] = useState(current?.time || "09:00")
  const [recurrence, setRecurrence] = useState(reminder?.enabled ? reminder.recurrence || "none" : "none")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const quick = quickReminderTimes()

  const submit = async (at) => {
    setError("")
    const instant = osloToUtc(at.date, at.time)
    if (!instant || (recurrence === "none" && instant <= new Date())) return setError(t("notesPage.reminderPast"))
    setBusy(true)
    try {
      await onSave({
        enabled: true,
        at,
        email: true,
        recurrence,
        customEvery: reminder?.customEvery || 1,
        customUnit: reminder?.customUnit || "days",
        onlyIfUnfinished: Boolean(reminder?.onlyIfUnfinished),
        followUpHours: reminder?.followUpHours || 24,
      })
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await onSave({ enabled: false })
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const repeats = reminder?.recurrence === "custom" ? [...REPEATS, "custom"] : REPEATS

  return (
    <Sheet title={t("notesPage.reminderTitle")} onClose={onClose}>
      {reminder?.enabled && reminder.nextAt && (
        <p className="mb-[12px] rounded-[10px] bg-[#ff4b00]/10 px-[12px] py-[10px] text-[13px] text-[#ffb08a]">
          {t("notesPage.reminderSet", { when: formatInstantDateTime(reminder.nextAt) })}
        </p>
      )}

      <ul className="flex flex-col gap-[6px]">
        {quick.map((q) => {
          const at = osloToUtc(q.date, q.time)
          return (
            <li key={q.key}>
              <button
                type="button"
                disabled={busy}
                onClick={() => submit({ date: q.date, time: q.time })}
                className="flex min-h-[52px] w-full items-center justify-between gap-[12px] rounded-[12px] bg-white/[0.04] px-[14px] text-left text-[15px] font-[600] text-white transition-colors hover:bg-white/[0.08] disabled:opacity-50"
              >
                <span>{t(`notesPage.${q.key}`)}</span>
                <span className="text-[13px] font-[500] text-white/50">
                  {q.key === "laterToday" ? formatInstantTime(at) : formatInstantDateTime(at, { weekday: "short", day: "numeric", month: "short" })}
                </span>
              </button>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            onClick={() => setCustom((v) => !v)}
            aria-expanded={custom}
            className="flex min-h-[52px] w-full items-center justify-between gap-[12px] rounded-[12px] bg-white/[0.04] px-[14px] text-left text-[15px] font-[600] text-white transition-colors hover:bg-white/[0.08]"
          >
            <span className="flex items-center gap-[8px]">
              <CalendarClock size={16} className="text-white/50" /> {t("notesPage.customTime")}
            </span>
            <ChevronRight size={16} className={`text-white/40 transition-transform ${custom ? "rotate-90" : ""}`} />
          </button>
        </li>
      </ul>

      {custom && (
        <div className="mt-[10px] grid grid-cols-2 gap-[8px]">
          <label className="text-[12px] font-[600] text-white/60">
            {t("notesPage.reminderDate")}
            <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} className={`${field} mt-[4px]`} />
          </label>
          <label className="text-[12px] font-[600] text-white/60">
            {t("notesPage.reminderTime")}
            <input type="time" value={time} step={300} onChange={(e) => setTime(e.target.value)} className={`${field} mt-[4px]`} />
          </label>
        </div>
      )}

      <label className="mt-[12px] flex items-center justify-between gap-[12px] text-[14px] text-white/75">
        {t("notesPage.repeat")}
        <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className="h-[42px] rounded-[10px] border border-white/15 bg-[#1d1e1e] px-[10px] text-[14px] text-white outline-none focus:border-[#ff4b00]">
          {repeats.map((r) => (
            <option key={r} value={r}>
              {r === "custom"
                ? t("notesPage.everyCustom", { n: reminder.customEvery, unit: t(`notesPage.unit_${reminder.customUnit}`) })
                : t(`notesPage.repeat_${r}`)}
            </option>
          ))}
        </select>
      </label>

      {custom && (
        <button
          type="button"
          disabled={busy || !date || !time}
          onClick={() => submit({ date, time })}
          className="mt-[12px] h-[48px] w-full rounded-[12px] bg-[#ff4b00] text-[15px] font-[800] text-white transition-colors hover:bg-[#e64400] disabled:opacity-50"
        >
          {t("notesPage.setReminder")}
        </button>
      )}

      <p className="mt-[12px] break-words text-[12.5px] text-white/55">{recipientLine}</p>
      {error && (
        <p role="alert" className="mt-[8px] text-[13px] text-red-400">
          {error}
        </p>
      )}

      {reminder?.enabled && (
        <button
          type="button"
          disabled={busy}
          onClick={remove}
          className="mt-[12px] flex h-[46px] w-full items-center justify-center gap-[8px] rounded-[12px] border border-white/12 text-[14px] font-[700] text-red-300 hover:bg-red-500/10 disabled:opacity-50"
        >
          <BellOff size={16} /> {t("notesPage.removeReminder")}
        </button>
      )}
    </Sheet>
  )
}
