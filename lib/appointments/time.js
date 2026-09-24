// Shared appointment time utilities — used by both the API routes and the
// browser, so this file has no dependencies and only relative imports.
//
// Two separate concepts live here and must never be mixed:
//  - Business timezone: every availability calculation happens in
//    Europe/Oslo (CET/CEST handled by the Intl timezone database, never a
//    fixed UTC offset), whatever timezone the server or visitor is in.
//  - Display format: "12h" or "24h". Presentation only — slot times are
//    always stored and exchanged as normalized 24-hour "HH:MM" strings.

export const BUSINESS_TIMEZONE = "Europe/Oslo"
export const SLOT_INTERVAL_MINUTES = 30
export const TIME_FORMATS = ["12h", "24h"]
export const DEFAULT_TIME_FORMAT = "12h"

// Monday-first, matching how the business (and the dashboard calendar) reads a week.
export const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

const pad = (n) => String(n).padStart(2, "0")

export function isTimeFormat(value) {
  return TIME_FORMATS.includes(value)
}

// Every slot start of a day as "HH:MM" — 48 entries at the default interval.
// Generated once; 12h/24h is applied only when displaying.
export function generateDailySlots({ intervalMinutes = SLOT_INTERVAL_MINUTES } = {}) {
  const slots = []
  for (let m = 0; m < 24 * 60; m += intervalMinutes) slots.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`)
  return slots
}

export const DAILY_SLOTS = generateDailySlots()

// "9:5", "09:05", "9:30 pm", "12:00 AM" → "HH:MM" (24-hour), or null.
export function normalizeAppointmentTime(value) {
  const match = /^\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm])?\s*$/.exec(String(value ?? ""))
  if (!match) return null
  let hour = Number(match[1])
  const minute = Number(match[2])
  const meridiem = match[3]?.toUpperCase()
  if (minute > 59) return null
  if (meridiem) {
    if (hour < 1 || hour > 12) return null
    hour = (hour % 12) + (meridiem === "PM" ? 12 : 0)
  } else if (hour > 23) {
    return null
  }
  return `${pad(hour)}:${pad(minute)}`
}

export function timeToMinutes(time) {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

export function minutesToTime(minutes) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
}

// "15:30" → "03:30 PM" (12h) or "15:30" (24h). The one place AM/PM is computed.
export function formatAppointmentTime(time, timeFormat = DEFAULT_TIME_FORMAT) {
  const normalized = normalizeAppointmentTime(time)
  if (!normalized) return ""
  if (timeFormat === "24h") return normalized
  const [h, m] = normalized.split(":").map(Number)
  return `${pad(h % 12 === 0 ? 12 : h % 12)}:${pad(m)} ${h < 12 ? "AM" : "PM"}`
}

// Inclusive list of slot starts between two slot times ("08:00".."17:00" →
// 08:00, 08:30, …, 17:00) — how "available from … to …" ranges are read.
export function slotsInRange(startTime, endTime, slots = DAILY_SLOTS) {
  const from = timeToMinutes(startTime)
  const to = timeToMinutes(endTime)
  return slots.filter((s) => {
    const m = timeToMinutes(s)
    return m >= from && m <= to
  })
}

// ---------------------------------------------------------------------------
// Europe/Oslo date/time conversion
// ---------------------------------------------------------------------------

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

// A UTC instant → its Oslo wall-clock parts.
export function osloParts(value) {
  const date = value instanceof Date ? value : new Date(value)
  const p = Object.fromEntries(partsFormatter.formatToParts(date).map((x) => [x.type, x.value]))
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
  }
}

// Current Oslo date + time — never the browser's or server's own clock zone.
export function getNorwayNow(now = new Date()) {
  return osloParts(now)
}

// Oslo's UTC offset (minutes) at a given instant — +60 in winter, +120 in summer.
function osloOffsetMinutes(utcMs) {
  const p = osloParts(new Date(utcMs))
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - utcMs) / 60000)
}

// An Oslo wall-clock date + time → the UTC instant (Date), or null when that
// wall time doesn't exist (the skipped hour on the spring DST change). On the
// autumn change, where 02:00–02:59 happens twice, the first (summer-time)
// occurrence is used.
export function osloToUtc(date, time) {
  const [y, mo, d] = date.split("-").map(Number)
  const [h, mi] = time.split(":").map(Number)
  const naive = Date.UTC(y, mo - 1, d, h, mi)
  const candidates = [...new Set([osloOffsetMinutes(naive - 3 * 3600000), osloOffsetMinutes(naive + 3 * 3600000)])]
    .map((offset) => naive - offset * 60000)
    .filter((ms) => {
      const p = osloParts(new Date(ms))
      return p.date === date && p.time === time
    })
    .sort((a, b) => a - b)
  return candidates.length ? new Date(candidates[0]) : null
}

export function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false
  const [y, m, d] = value.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

// Calendar arithmetic on plain "YYYY-MM-DD" strings (no timezone involved).
export function addDays(date, days) {
  const [y, m, d] = date.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

// 0 = Monday … 6 = Sunday.
export function weekdayIndex(date) {
  const [y, m, d] = date.split("-").map(Number)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
}

export function startOfWeekDate(date) {
  return addDays(date, -weekdayIndex(date))
}

export function monthBounds(date) {
  const [y, m] = date.split("-").map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(last)}` }
}

// ---------------------------------------------------------------------------
// Display helpers (Oslo time, chosen 12h/24h format)
// ---------------------------------------------------------------------------

// Date part of an instant, as it reads in Oslo, in the visitor's language.
export function formatOsloDate(value, locale, options = { dateStyle: "medium" }) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "–"
  return date.toLocaleDateString(locale, { ...options, timeZone: BUSINESS_TIMEZONE })
}

// A plain "YYYY-MM-DD" (no instant) in the visitor's language — noon UTC keeps
// it on the same calendar day in any timezone.
export function formatDateString(date, locale, options = { dateStyle: "medium" }) {
  if (!isValidDateString(date)) return "–"
  const [y, m, d] = date.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(locale, { ...options, timeZone: "UTC" })
}

// Time part of an instant in Oslo, formatted 12h/24h.
export function formatOsloTime(value, timeFormat) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "–"
  return formatAppointmentTime(osloParts(date).time, timeFormat)
}

export function formatOsloDateTime(value, locale, timeFormat, dateOptions) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "–"
  return `${formatOsloDate(date, locale, dateOptions)} ${formatOsloTime(date, timeFormat)}`
}

// Day-part groups for long slot lists. Labels don't depend on 12h/24h.
export const SLOT_GROUPS = [
  { key: "night", from: "00:00", to: "05:30" },
  { key: "morning", from: "06:00", to: "11:30" },
  { key: "afternoon", from: "12:00", to: "17:30" },
  { key: "evening", from: "18:00", to: "23:30" },
]

export function groupSlots(items, getTime = (x) => x.time) {
  return SLOT_GROUPS.map((g) => ({
    ...g,
    items: items.filter((x) => {
      const t = getTime(x)
      return t >= g.from && t <= g.to
    }),
  })).filter((g) => g.items.length > 0)
}
