"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarCog, Check, Copy, Pencil, Power, RotateCcw, Save, Trash2, X } from "lucide-react"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/locale"
import { useTimeFormat } from "@/context/TimeFormatContext"
import TimeFormatToggle from "../../components/appointments/TimeFormatToggle"
import {
  BUSINESS_TIMEZONE,
  DAILY_SLOTS,
  SLOT_INTERVAL_MINUTES,
  WEEKDAYS,
  addDays,
  formatDateString,
  getNorwayNow,
  groupSlots,
  monthBounds,
  slotsInRange,
  startOfWeekDate,
} from "@/lib/appointments/time"

// Owner + administrator page for the booking schedule. Everything here is
// stored as normalized "HH:MM" Europe/Oslo slot times; the 12h/24h toggle
// only changes labels. Both roles edit the same shared configuration.

const A_MONDAY = "2026-01-05" // any Monday — used to get localized weekday names
const card = "rounded-[14px] border border-white/[0.08] bg-[#111212]"
const input =
  "w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[12px] py-[9px] text-[13px] text-white outline-none focus:border-[#ff4b00]"
const btn =
  "inline-flex items-center justify-center gap-[7px] rounded-[8px] border border-white/15 px-[12px] py-[8px] text-[12.5px] font-[700] text-white/80 transition-colors hover:bg-white/[0.06] disabled:opacity-40"
const btnPrimary =
  "inline-flex items-center justify-center gap-[7px] rounded-[8px] bg-[#ff4b00] px-[14px] py-[9px] text-[12.5px] font-[800] text-white transition hover:brightness-110 disabled:opacity-50"

function weekdayName(i, style = "long") {
  return formatDateString(addDays(A_MONDAY, i), getLocale(), { weekday: style })
}

// Selects of the 48 slots, labelled in the active format.
function SlotSelect({ value, onChange, id, label }) {
  const { formatTime } = useTimeFormat()
  return (
    <div>
      <label htmlFor={id} className="mb-[6px] block text-[12px] font-[600] text-white/60">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${input} tabular-nums`}>
        {DAILY_SLOTS.map((s) => (
          <option key={s} value={s} className="bg-[#111212]">
            {formatTime(s)}
          </option>
        ))}
      </select>
    </div>
  )
}

// A grouped grid of ON/OFF switches for the 48 slots.
function SlotToggleGrid({ enabled, onToggle, compact = false }) {
  const { t } = useTranslation()
  const { formatTime } = useTimeFormat()
  return (
    <div className="space-y-[14px]">
      {groupSlots(DAILY_SLOTS, (x) => x).map((group) => (
        <div key={group.key}>
          <p className="mb-[8px] text-[10.5px] font-[800] uppercase tracking-[0.1em] text-white/40">{t(`timeFormat.group_${group.key}`)}</p>
          <div className={`grid gap-[6px] ${compact ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"}`}>
            {group.items.map((time) => {
              const on = enabled.has(time)
              return (
                <button
                  key={time}
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${formatTime(time)} ${on ? t("availabilityPage.on") : t("availabilityPage.off")}`}
                  onClick={() => onToggle(time)}
                  className={`flex items-center justify-between gap-[8px] rounded-[8px] border px-[10px] py-[7px] text-[12px] font-[700] tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-[#ff4b00] ${
                    on ? "border-emerald-500/40 bg-emerald-500/[0.08] text-white" : "border-white/10 bg-white/[0.015] text-white/40"
                  }`}
                >
                  <span>{formatTime(time)}</span>
                  <span className={`text-[10px] font-[800] ${on ? "text-emerald-300" : "text-white/35"}`}>{on ? t("availabilityPage.on") : t("availabilityPage.off")}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Weekly schedule
// ---------------------------------------------------------------------------

function toSets(schedule) {
  return Object.fromEntries(WEEKDAYS.map((d) => [d, new Set(schedule?.[d] || [])]))
}

function WeeklySchedule({ settings, onSaved }) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(() => toSets(settings.weeklySchedule))
  const [day, setDay] = useState(0)
  const [from, setFrom] = useState("08:00")
  const [to, setTo] = useState("17:00")
  const [copyTarget, setCopyTarget] = useState(1)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => setDraft(toSets(settings.weeklySchedule)), [settings])

  const dayKey = WEEKDAYS[day]
  const current = draft[dayKey]
  const dirty = WEEKDAYS.some((d) => {
    const saved = settings.weeklySchedule[d] || []
    return saved.length !== draft[d].size || saved.some((s) => !draft[d].has(s))
  })

  const setDaySlots = (key, slots) => setDraft((prev) => ({ ...prev, [key]: new Set(slots) }))
  const toggle = (time) => {
    const next = new Set(current)
    if (next.has(time)) next.delete(time)
    else next.add(time)
    setDaySlots(dayKey, next)
  }
  const range = from <= to ? slotsInRange(from, to) : []

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const weeklySchedule = Object.fromEntries(WEEKDAYS.map((d) => [d, DAILY_SLOTS.filter((s) => draft[d].has(s))]))
      const { settings: next } = await api.put("/appointments/availability/settings", { weeklySchedule })
      onSaved(next)
      setMessage({ ok: true, text: t("availabilityPage.saved") })
    } catch (err) {
      setMessage({ ok: false, text: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-[16px]">
      <div className="flex flex-wrap gap-[8px]" role="tablist" aria-label={t("availabilityPage.weekdaysLabel")}>
        {WEEKDAYS.map((d, i) => {
          const count = draft[d].size
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={day === i}
              onClick={() => {
                setDay(i)
                setCopyTarget((i + 1) % 7)
              }}
              className={`flex min-w-[92px] flex-col items-start rounded-[10px] border px-[12px] py-[8px] text-left transition-colors ${
                day === i ? "border-[#ff4b00] bg-[#ff4b00]/10" : "border-white/10 hover:border-white/25"
              }`}
            >
              <span className={`text-[13px] font-[800] ${day === i ? "text-[#ff4b00]" : "text-white"}`}>{weekdayName(i, "short")}</span>
              <span className="text-[11px] text-white/45">
                {count === 0 ? t("availabilityPage.closed") : t("availabilityPage.slotsOpen", { n: count, total: DAILY_SLOTS.length })}
              </span>
            </button>
          )
        })}
      </div>

      <div className={`${card} p-[18px]`}>
        <div className="flex flex-wrap items-center justify-between gap-[12px]">
          <h2 className="text-[17px] font-[800] text-white">{weekdayName(day)}</h2>
          <label className="flex cursor-pointer items-center gap-[10px] text-[13px] font-[600] text-white/75">
            {t("availabilityPage.enableDay")}
            <button
              type="button"
              role="switch"
              aria-checked={current.size > 0}
              aria-label={t("availabilityPage.enableDay")}
              onClick={() => setDaySlots(dayKey, current.size > 0 ? [] : DAILY_SLOTS)}
              className={`relative h-[24px] w-[44px] rounded-full transition-colors ${current.size > 0 ? "bg-[#ff4b00]" : "bg-white/15"}`}
            >
              <span className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-all ${current.size > 0 ? "left-[23px]" : "left-[3px]"}`} />
            </button>
          </label>
        </div>

        <div className="mt-[16px] grid gap-[12px] rounded-[10px] border border-white/[0.07] bg-white/[0.02] p-[14px] sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <SlotSelect id="range-from" label={t("availabilityPage.availableFrom")} value={from} onChange={setFrom} />
          <SlotSelect id="range-to" label={t("availabilityPage.availableTo")} value={to} onChange={setTo} />
          <div className="flex flex-wrap gap-[8px]">
            <button type="button" className={btnPrimary} disabled={!range.length} onClick={() => setDaySlots(dayKey, range)} title={t("availabilityPage.setRangeHint")}>
              {t("availabilityPage.setRange")}
            </button>
            <button type="button" className={btn} disabled={!range.length} onClick={() => setDaySlots(dayKey, [...current, ...range])}>
              {t("availabilityPage.enableRange")}
            </button>
            <button type="button" className={btn} disabled={!range.length} onClick={() => setDaySlots(dayKey, [...current].filter((s) => !range.includes(s)))}>
              {t("availabilityPage.disableRange")}
            </button>
          </div>
          {!range.length && <p className="text-[12px] text-red-300 sm:col-span-3">{t("availabilityPage.rangeInvalid")}</p>}
        </div>

        <div className="mt-[14px] flex flex-wrap items-center gap-[8px]">
          <button type="button" className={btn} onClick={() => setDaySlots(dayKey, DAILY_SLOTS)}>
            <Check size={14} /> {t("availabilityPage.enableAll")}
          </button>
          <button type="button" className={btn} onClick={() => setDaySlots(dayKey, [])}>
            <X size={14} /> {t("availabilityPage.disableAll")}
          </button>
          <button type="button" className={btn} onClick={() => setDaySlots(dayKey, settings.weeklySchedule[dayKey] || [])}>
            <RotateCcw size={14} /> {t("availabilityPage.resetDay")}
          </button>
          <span className="mx-[4px] hidden h-[20px] w-px bg-white/10 sm:inline-block" />
          <label htmlFor="copy-target" className="sr-only">
            {t("availabilityPage.copyTo")}
          </label>
          <select id="copy-target" value={copyTarget} onChange={(e) => setCopyTarget(Number(e.target.value))} className="rounded-[8px] border border-white/15 bg-white/[0.04] px-[10px] py-[8px] text-[12.5px] text-white">
            {WEEKDAYS.map((d, i) =>
              i === day ? null : (
                <option key={d} value={i} className="bg-[#111212]">
                  {weekdayName(i)}
                </option>
              )
            )}
          </select>
          <button type="button" className={btn} onClick={() => setDaySlots(WEEKDAYS[copyTarget], current)}>
            <Copy size={14} /> {t("availabilityPage.copyTo")}
          </button>
          <button type="button" className={btn} onClick={() => setDraft(Object.fromEntries(WEEKDAYS.map((d) => [d, new Set(current)])))}>
            <Copy size={14} /> {t("availabilityPage.copyToAll")}
          </button>
        </div>

        <div className="mt-[18px]">
          <SlotToggleGrid enabled={current} onToggle={toggle} />
        </div>
      </div>

      <div className="sticky bottom-[12px] z-10 flex flex-wrap items-center justify-between gap-[10px] rounded-[12px] border border-white/10 bg-[#161717]/95 px-[14px] py-[10px] backdrop-blur">
        <p className={`text-[12.5px] ${message ? (message.ok ? "text-emerald-300" : "text-red-300") : dirty ? "text-[#ff9b6a]" : "text-white/45"}`} aria-live="polite">
          {message?.text || (dirty ? t("availabilityPage.unsaved") : t("availabilityPage.upToDate"))}
        </p>
        <div className="flex flex-wrap gap-[8px]">
          <button type="button" className={btn} onClick={() => setDraft(toSets(Object.fromEntries(WEEKDAYS.map((d) => [d, DAILY_SLOTS]))))} title={t("availabilityPage.resetScheduleHint")}>
            <RotateCcw size={14} /> {t("availabilityPage.resetSchedule")}
          </button>
          <button type="button" className={btn} disabled={!dirty || saving} onClick={() => setDraft(toSets(settings.weeklySchedule))}>
            {t("availabilityPage.discard")}
          </button>
          <button type="button" className={btnPrimary} disabled={!dirty || saving} onClick={save}>
            <Save size={14} /> {saving ? t("availabilityPage.saving") : t("availabilityPage.save")}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Overrides
// ---------------------------------------------------------------------------

const EMPTY_FORM = {
  type: "single_date",
  available: false,
  startDate: "",
  endDate: "",
  month: "",
  daysOfWeek: [],
  timeMode: "range",
  startTime: "09:00",
  endTime: "11:30",
  slotTimes: [],
  note: "",
}

function formFromRule(rule) {
  return {
    ...EMPTY_FORM,
    type: rule.type,
    available: rule.available,
    startDate: rule.startDate || "",
    endDate: rule.endDate || "",
    month: rule.type === "month" && rule.startDate ? rule.startDate.slice(0, 7) : "",
    daysOfWeek: rule.daysOfWeek || [],
    timeMode: rule.allDay ? "allDay" : rule.slotTimes?.length ? "slots" : "range",
    startTime: rule.startTime || "09:00",
    endTime: rule.endTime || "11:30",
    slotTimes: rule.slotTimes || [],
    note: rule.note || "",
  }
}

function payloadFromForm(f) {
  const body = { type: f.type, available: f.available, note: f.note, daysOfWeek: f.daysOfWeek }
  if (f.type === "single_date") body.startDate = f.startDate
  else if (f.type === "week") {
    const monday = f.startDate ? startOfWeekDate(f.startDate) : ""
    body.startDate = monday
    body.endDate = monday ? addDays(monday, 6) : ""
  } else if (f.type === "month") {
    const b = f.month ? monthBounds(`${f.month}-01`) : { start: "", end: "" }
    body.startDate = b.start
    body.endDate = b.end
  } else {
    body.startDate = f.startDate || null
    body.endDate = f.endDate || null
  }
  body.allDay = f.timeMode === "allDay"
  if (f.timeMode === "range") {
    body.startTime = f.startTime
    body.endTime = f.endTime
  }
  if (f.timeMode === "slots") body.slotTimes = f.slotTimes
  return body
}

function useRuleDescription() {
  const { t } = useTranslation()
  const { formatTime } = useTimeFormat()
  return useCallback(
    (rule) => {
      const d = (v, opts = { dateStyle: "medium" }) => formatDateString(v, getLocale(), opts)
      let dates
      if (rule.type === "single_date") dates = d(rule.startDate, { dateStyle: "full" })
      else if (rule.type === "month") dates = d(rule.startDate, { month: "long", year: "numeric" })
      else if (rule.type === "date_range" || rule.type === "week") dates = `${d(rule.startDate)} – ${d(rule.endDate)}`
      else {
        const days =
          rule.type === "weekly_recurring"
            ? t("availabilityPage.everyDays", { days: rule.daysOfWeek.map((i) => weekdayName(i)).join(", ") })
            : t("availabilityPage.everyDay")
        const bounds =
          rule.startDate && rule.endDate
            ? `${d(rule.startDate)} – ${d(rule.endDate)}`
            : rule.startDate
              ? t("availabilityPage.fromDate", { date: d(rule.startDate) })
              : rule.endDate
                ? t("availabilityPage.untilDate", { date: d(rule.endDate) })
                : t("availabilityPage.indefinitely")
        dates = `${days} · ${bounds}`
      }
      let times
      if (rule.allDay) times = t("availabilityPage.entireDay")
      else if (rule.slotTimes?.length) {
        const shown = rule.slotTimes.slice(0, 6).map(formatTime).join(", ")
        times = rule.slotTimes.length > 6 ? `${shown} ${t("availabilityPage.andMore", { n: rule.slotTimes.length - 6 })}` : shown
      } else times = `${formatTime(rule.startTime)} – ${formatTime(rule.endTime)}`
      return { dates, times }
    },
    [t, formatTime]
  )
}

function OverrideForm({ types, editing, onSaved, onCancel }) {
  const { t } = useTranslation()
  const [form, setForm] = useState(() => (editing ? formFromRule(editing) : { ...EMPTY_FORM, type: types[0] }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  useEffect(() => {
    setForm(editing ? formFromRule(editing) : { ...EMPTY_FORM, type: types[0] })
    setError("")
  }, [editing, types])

  const submit = async (e) => {
    e.preventDefault()
    setError("")
    setSaving(true)
    try {
      const body = payloadFromForm(form)
      if (editing) await api.patch(`/appointments/availability/overrides/${editing._id}`, body)
      else await api.post("/appointments/availability/overrides", body)
      onSaved()
      if (!editing) setForm({ ...EMPTY_FORM, type: form.type, available: form.available })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const weekPreview = form.type === "week" && form.startDate ? startOfWeekDate(form.startDate) : null
  const selectedSlots = new Set(form.slotTimes)

  return (
    <form onSubmit={submit} className={`${card} space-y-[16px] p-[18px]`}>
      <div className="flex items-center justify-between gap-[10px]">
        <h2 className="text-[16px] font-[800] text-white">{editing ? t("availabilityPage.editRule") : t("availabilityPage.newRule")}</h2>
        {editing && (
          <button type="button" onClick={onCancel} className={btn}>
            <X size={14} /> {t("availabilityPage.cancelEdit")}
          </button>
        )}
      </div>

      {error && <p className="rounded-[8px] bg-red-500/10 px-[12px] py-[8px] text-[13px] text-red-300">{error}</p>}

      <div className="grid gap-[12px] sm:grid-cols-2">
        <div>
          <label htmlFor="rule-type" className="mb-[6px] block text-[12px] font-[600] text-white/60">
            {t("availabilityPage.typeLabel")}
          </label>
          <select id="rule-type" value={form.type} onChange={(e) => set({ type: e.target.value })} className={input}>
            {types.map((type) => (
              <option key={type} value={type} className="bg-[#111212]">
                {t(`availabilityPage.type_${type}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="mb-[6px] block text-[12px] font-[600] text-white/60">{t("availabilityPage.statusLabel")}</span>
          <div role="radiogroup" aria-label={t("availabilityPage.statusLabel")} className="grid grid-cols-2 gap-[6px]">
            {[false, true].map((avail) => (
              <button
                key={String(avail)}
                type="button"
                role="radio"
                aria-checked={form.available === avail}
                onClick={() => set({ available: avail })}
                className={`rounded-[8px] border px-[10px] py-[9px] text-[12.5px] font-[700] ${
                  form.available === avail
                    ? avail
                      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300"
                      : "border-red-500/60 bg-red-500/10 text-red-300"
                    : "border-white/15 text-white/60"
                }`}
              >
                {avail ? t("availabilityPage.available") : t("availabilityPage.unavailable")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dates */}
      <div className="grid gap-[12px] sm:grid-cols-2">
        {form.type === "single_date" && (
          <div>
            <label htmlFor="rule-date" className="mb-[6px] block text-[12px] font-[600] text-white/60">{t("availabilityPage.dateLabel")}</label>
            <input id="rule-date" type="date" required value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} className={input} />
          </div>
        )}
        {form.type === "week" && (
          <div className="sm:col-span-2">
            <label htmlFor="rule-week" className="mb-[6px] block text-[12px] font-[600] text-white/60">{t("availabilityPage.weekLabel")}</label>
            <input id="rule-week" type="date" required value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} className={`${input} sm:max-w-[260px]`} />
            {weekPreview && (
              <p className="mt-[6px] text-[12px] text-white/50">
                {formatDateString(weekPreview, getLocale())} – {formatDateString(addDays(weekPreview, 6), getLocale())}
              </p>
            )}
          </div>
        )}
        {form.type === "month" && (
          <div>
            <label htmlFor="rule-month" className="mb-[6px] block text-[12px] font-[600] text-white/60">{t("availabilityPage.monthLabel")}</label>
            <input id="rule-month" type="month" required value={form.month} onChange={(e) => set({ month: e.target.value })} className={input} />
          </div>
        )}
        {["date_range", "weekly_recurring", "indefinite"].includes(form.type) && (
          <>
            <div>
              <label htmlFor="rule-from" className="mb-[6px] block text-[12px] font-[600] text-white/60">{t("availabilityPage.fromDateLabel")}</label>
              <input id="rule-from" type="date" required={form.type === "date_range"} value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} className={input} />
            </div>
            <div>
              <label htmlFor="rule-to" className="mb-[6px] block text-[12px] font-[600] text-white/60">{t("availabilityPage.toDateLabel")}</label>
              <input id="rule-to" type="date" required={form.type === "date_range"} min={form.startDate || undefined} value={form.endDate} onChange={(e) => set({ endDate: e.target.value })} className={input} />
            </div>
            {form.type !== "date_range" && <p className="-mt-[4px] text-[11.5px] text-white/40 sm:col-span-2">{t("availabilityPage.boundsHint")}</p>}
          </>
        )}
      </div>

      {form.type === "weekly_recurring" && (
        <fieldset>
          <legend className="mb-[6px] text-[12px] font-[600] text-white/60">{t("availabilityPage.weekdaysLabel")}</legend>
          <div className="flex flex-wrap gap-[6px]">
            {WEEKDAYS.map((d, i) => {
              const on = form.daysOfWeek.includes(i)
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ daysOfWeek: on ? form.daysOfWeek.filter((x) => x !== i) : [...form.daysOfWeek, i].sort() })}
                  className={`rounded-[8px] border px-[12px] py-[7px] text-[12.5px] font-[700] ${on ? "border-[#ff4b00] bg-[#ff4b00]/12 text-[#ff9b6a]" : "border-white/15 text-white/60"}`}
                >
                  {weekdayName(i, "short")}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}

      {/* Times */}
      <fieldset>
        <legend className="mb-[6px] text-[12px] font-[600] text-white/60">{t("availabilityPage.timesLabel")}</legend>
        <div role="radiogroup" aria-label={t("availabilityPage.timesLabel")} className="flex flex-wrap gap-[6px]">
          {["allDay", "range", "slots"].map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={form.timeMode === mode}
              onClick={() => set({ timeMode: mode })}
              className={`rounded-[8px] border px-[12px] py-[7px] text-[12.5px] font-[700] ${form.timeMode === mode ? "border-[#ff4b00] bg-[#ff4b00]/12 text-[#ff9b6a]" : "border-white/15 text-white/60"}`}
            >
              {t(`availabilityPage.timeMode_${mode}`)}
            </button>
          ))}
        </div>
        {form.timeMode === "range" && (
          <div className="mt-[12px] grid gap-[12px] sm:grid-cols-2">
            <SlotSelect id="rule-start" label={t("availabilityPage.fromTime")} value={form.startTime} onChange={(v) => set({ startTime: v })} />
            <SlotSelect id="rule-end" label={t("availabilityPage.toTime")} value={form.endTime} onChange={(v) => set({ endTime: v })} />
          </div>
        )}
        {form.timeMode === "slots" && (
          <div className="mt-[12px]">
            <SlotToggleGrid
              compact
              enabled={selectedSlots}
              onToggle={(time) =>
                set({ slotTimes: selectedSlots.has(time) ? form.slotTimes.filter((s) => s !== time) : DAILY_SLOTS.filter((s) => s === time || selectedSlots.has(s)) })
              }
            />
            <p className="mt-[8px] text-[11.5px] text-white/40">{t("availabilityPage.slotsHint")}</p>
          </div>
        )}
      </fieldset>

      <div>
        <label htmlFor="rule-note" className="mb-[6px] block text-[12px] font-[600] text-white/60">{t("availabilityPage.noteLabel")}</label>
        <input id="rule-note" value={form.note} maxLength={200} onChange={(e) => set({ note: e.target.value })} placeholder={t("availabilityPage.notePlaceholder")} className={input} />
      </div>

      <button type="submit" disabled={saving} className={btnPrimary}>
        <Save size={14} /> {saving ? t("availabilityPage.saving") : editing ? t("availabilityPage.saveChanges") : t("availabilityPage.saveRule")}
      </button>
    </form>
  )
}

function OverrideList({ rules, onEdit, onChanged, editingId }) {
  const { t } = useTranslation()
  const describe = useRuleDescription()
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState("")

  const act = async (rule, fn) => {
    setBusy(rule._id)
    setError("")
    try {
      await fn()
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  if (rules.length === 0) return <p className={`${card} p-[20px] text-center text-[13px] text-white/45`}>{t("availabilityPage.noRules")}</p>

  return (
    <div className="space-y-[10px]">
      {error && <p className="rounded-[8px] bg-red-500/10 px-[12px] py-[8px] text-[13px] text-red-300">{error}</p>}
      {rules.map((rule) => {
        const { dates, times } = describe(rule)
        return (
          <div key={rule._id} className={`${card} flex flex-wrap items-start justify-between gap-[12px] p-[14px] ${rule.active ? "" : "opacity-60"} ${editingId === rule._id ? "border-[#ff4b00]/60" : ""}`}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-[6px]">
                <span className={`rounded-[5px] border px-[7px] py-[2px] text-[10.5px] font-[800] uppercase ${rule.available ? "border-emerald-500/40 text-emerald-300" : "border-red-500/40 text-red-300"}`}>
                  {rule.available ? t("availabilityPage.available") : t("availabilityPage.unavailable")}
                </span>
                <span className={`rounded-[5px] border px-[7px] py-[2px] text-[10.5px] font-[800] uppercase ${rule.active ? "border-white/25 text-white/70" : "border-white/10 text-white/40"}`}>
                  {rule.active ? t("availabilityPage.active") : t("availabilityPage.inactive")}
                </span>
                <span className="text-[11px] text-white/40">{t(`availabilityPage.type_${rule.type}`)}</span>
              </div>
              <p className="mt-[6px] text-[13.5px] font-[700] text-white">{dates}</p>
              <p className="mt-[2px] text-[12.5px] tabular-nums text-white/60">{times}</p>
              {rule.note && <p className="mt-[4px] text-[12px] italic text-white/45">{rule.note}</p>}
            </div>
            <div className="flex flex-wrap gap-[6px]">
              <button type="button" className={btn} disabled={busy === rule._id} onClick={() => onEdit(rule)}>
                <Pencil size={13} /> {t("availabilityPage.edit")}
              </button>
              <button
                type="button"
                className={btn}
                disabled={busy === rule._id}
                onClick={() => act(rule, () => api.patch(`/appointments/availability/overrides/${rule._id}`, { active: !rule.active }))}
              >
                <Power size={13} /> {rule.active ? t("availabilityPage.deactivate") : t("availabilityPage.activate")}
              </button>
              <button
                type="button"
                className={`${btn} hover:border-red-500/50 hover:text-red-300`}
                disabled={busy === rule._id}
                onClick={() => window.confirm(t("availabilityPage.deleteConfirm")) && act(rule, () => api.delete(`/appointments/availability/overrides/${rule._id}`))}
              >
                <Trash2 size={13} /> {t("availabilityPage.delete")}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function OverridesTab({ types, rules, onChanged, intro }) {
  const [editing, setEditing] = useState(null)
  const mine = rules.filter((r) => types.includes(r.type))
  return (
    <div className="grid gap-[16px] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-[12px]">
        <p className="text-[13px] leading-[1.6] text-white/55">{intro}</p>
        <OverrideForm
          types={types}
          editing={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            onChanged()
          }}
        />
      </div>
      <OverrideList rules={mine} editingId={editing?._id} onEdit={setEditing} onChanged={onChanged} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Preview — exactly what the booking modal will offer for a date
// ---------------------------------------------------------------------------

function Preview() {
  const { t } = useTranslation()
  const { formatTime } = useTimeFormat()
  const [date, setDate] = useState(() => getNorwayNow().date)
  const [data, setData] = useState(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError("")
    api
      .get(`/appointments/availability?date=${date}`)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [date])

  const open = data?.slots.filter((s) => s.available).length ?? 0

  return (
    <div className={`${card} space-y-[14px] p-[18px]`}>
      <div className="flex flex-wrap items-end gap-[14px]">
        <div>
          <label htmlFor="preview-date" className="mb-[6px] block text-[12px] font-[600] text-white/60">{t("availabilityPage.dateLabel")}</label>
          <input id="preview-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={input} />
        </div>
        {data && <p className="pb-[10px] text-[13px] text-white/60">{t("availabilityPage.previewCount", { n: open, total: data.slots.length })}</p>}
      </div>
      <p className="text-[12.5px] text-white/45">{t("availabilityPage.previewHint")}</p>
      {error && <p className="text-[13px] text-red-300">{error}</p>}
      {!data && !error && <p className="text-[13px] text-white/40">{t("bookMeetingModal.checkingSlots")}</p>}
      {data && (
        <div className="space-y-[14px]">
          {groupSlots(data.slots).map((group) => (
            <div key={group.key}>
              <p className="mb-[8px] text-[10.5px] font-[800] uppercase tracking-[0.1em] text-white/40">{t(`timeFormat.group_${group.key}`)}</p>
              <div className="grid grid-cols-2 gap-[6px] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {group.items.map((s) => (
                  <div
                    key={s.time}
                    className={`rounded-[8px] border px-[10px] py-[7px] text-[12px] tabular-nums ${s.available ? "border-emerald-500/40 bg-emerald-500/[0.08] text-white" : "border-white/10 text-white/40"}`}
                  >
                    <span className="font-[700]">{formatTime(s.time)}</span>
                    <span className="block text-[10.5px]">{s.available ? t("availabilityPage.bookable") : t(`availabilityPage.reason_${s.reason}`)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

const TABS = ["weekly", "overrides", "periods", "preview"]
const DATE_OVERRIDE_TYPES = ["single_date", "weekly_recurring", "indefinite"]
const PERIOD_TYPES = ["date_range", "week", "month"]

export default function MeetingAvailability() {
  const { t } = useTranslation()
  const [tab, setTab] = useState("weekly")
  const [settings, setSettings] = useState(null)
  const [rules, setRules] = useState([])
  const [error, setError] = useState("")

  const loadRules = useCallback(() => {
    api
      .get("/appointments/availability/overrides")
      .then((d) => setRules(d.overrides))
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    api
      .get("/appointments/availability/settings")
      .then((d) => setSettings(d.settings))
      .catch((err) => setError(err.message))
    loadRules()
  }, [loadRules])

  const counts = useMemo(
    () => ({
      overrides: rules.filter((r) => DATE_OVERRIDE_TYPES.includes(r.type) && r.active).length,
      periods: rules.filter((r) => PERIOD_TYPES.includes(r.type) && r.active).length,
    }),
    [rules]
  )

  return (
    <div>
      <div className="flex flex-col justify-between gap-[14px] lg:flex-row lg:items-start">
        <div>
          <h1 className="flex items-center gap-[10px] text-[26px] font-[800] tracking-[-0.02em] text-white">
            <CalendarCog size={24} className="text-[#ff4b00]" />
            {t("availabilityPage.title")}
          </h1>
          <p className="mt-[4px] max-w-[640px] text-[14px] text-white/50">{t("availabilityPage.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-[10px]">
          <span className="rounded-[8px] border border-white/10 bg-white/[0.03] px-[10px] py-[6px] text-[12px] text-white/60">
            {t("availabilityPage.timezone")}: <span className="font-[700] text-white">{BUSINESS_TIMEZONE}</span>
          </span>
          <span className="rounded-[8px] border border-white/10 bg-white/[0.03] px-[10px] py-[6px] text-[12px] text-white/60">
            {t("availabilityPage.interval")}: <span className="font-[700] text-white">{t("availabilityPage.minutes", { n: SLOT_INTERVAL_MINUTES })}</span>
          </span>
          <TimeFormatToggle />
        </div>
      </div>

      <div className="mt-[20px] flex gap-[4px] overflow-x-auto border-b border-white/[0.08]" role="tablist">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`-mb-px shrink-0 border-b-2 px-[14px] py-[10px] text-[13px] font-[700] transition-colors ${
              tab === key ? "border-[#ff4b00] text-white" : "border-transparent text-white/50 hover:text-white/80"
            }`}
          >
            {t(`availabilityPage.tab_${key}`)}
            {counts[key] > 0 && <span className="ml-[6px] rounded-full bg-white/10 px-[6px] py-[1px] text-[10.5px] text-white/70">{counts[key]}</span>}
          </button>
        ))}
      </div>

      {error && <p className="mt-[14px] rounded-[8px] bg-red-500/10 px-[12px] py-[8px] text-[13px] text-red-300">{error}</p>}

      <div className="mt-[18px]">
        {tab === "weekly" &&
          (settings ? (
            <WeeklySchedule settings={settings} onSaved={setSettings} />
          ) : (
            <p className="text-[13px] text-white/40">{t("availabilityPage.loading")}</p>
          ))}
        {tab === "overrides" && <OverridesTab types={DATE_OVERRIDE_TYPES} rules={rules} onChanged={loadRules} intro={t("availabilityPage.overridesIntro")} />}
        {tab === "periods" && <OverridesTab types={PERIOD_TYPES} rules={rules} onChanged={loadRules} intro={t("availabilityPage.periodsIntro")} />}
        {tab === "preview" && <Preview />}
      </div>
    </div>
  )
}
