// Pure availability resolution — no database, no clock of its own — so the
// exact same rules run in the API, in the dashboard preview, and in tests.
import {
  DAILY_SLOTS,
  SLOT_INTERVAL_MINUTES,
  WEEKDAYS,
  getNorwayNow,
  osloToUtc,
  slotsInRange,
  timeToMinutes,
  weekdayIndex,
} from "./time.js"

// Override types, from most to least specific. The level decides priority
// when rules disagree (see resolveAvailabilityForDate).
//   single_date      one date
//   date_range       from startDate to endDate (also used for a week / month)
//   week, month      a date range picked as a whole week / calendar month
//   weekly_recurring chosen weekdays, optionally bounded by start/end date
//   indefinite       every day, optionally bounded by start/end date
export const OVERRIDE_TYPES = ["single_date", "date_range", "week", "month", "weekly_recurring", "indefinite"]

const PRIORITY = {
  single_date: 1, // explicit date-specific override
  date_range: 2, // temporary date / date-range rules
  week: 2,
  month: 2,
  weekly_recurring: 3, // recurring rules
  indefinite: 3,
}

export function defaultWeeklySchedule() {
  return Object.fromEntries(WEEKDAYS.map((day) => [day, [...DAILY_SLOTS]]))
}

// Does this rule cover `date` at all (ignoring which times)?
export function overrideAppliesToDate(rule, date) {
  if (!rule.active) return false
  if (rule.startDate && date < rule.startDate) return false
  if (rule.endDate && date > rule.endDate) return false
  if (rule.type === "single_date") return date === rule.startDate
  if (rule.type === "weekly_recurring" && !(rule.daysOfWeek || []).includes(weekdayIndex(date))) return false
  return true
}

// Which slot times a rule touches.
export function overrideSlotTimes(rule) {
  if (rule.allDay) return DAILY_SLOTS
  if (rule.slotTimes?.length) return rule.slotTimes
  if (rule.startTime && rule.endTime) return slotsInRange(rule.startTime, rule.endTime)
  return []
}

// Slot times (Oslo) occupied by an appointment on `date`. A 60-minute
// meeting at 10:00 occupies 10:00 and 10:30; anything touching a slot at all
// (e.g. an internal 10:15–10:45 meeting) blocks that slot.
export function slotStartsForDate(date) {
  return new Map(DAILY_SLOTS.map((time) => [time, osloToUtc(date, time)]))
}

export function occupiedSlotTimes(appointment, date, starts = slotStartsForDate(date)) {
  const start = new Date(appointment.start).getTime()
  const end = new Date(appointment.end).getTime()
  if (!(end > start)) return []
  const out = []
  for (const [time, slotStart] of starts) {
    if (!slotStart) continue
    const s = slotStart.getTime()
    if (s < end && s + SLOT_INTERVAL_MINUTES * 60000 > start) out.push(time)
  }
  return out
}

// Resolve every slot of one Oslo date. Priority (highest first):
//   1. existing (non-cancelled) appointment      → "already_booked"
//   2. explicit single-date override
//   3. temporary date-range / week / month rule
//   4. recurring weekday / indefinite rule
//   5. base weekly schedule                      → "outside_schedule" if off
// Slots in the past (Oslo "now") or inside the spring DST gap are never bookable.
// Within one priority level, "unavailable" wins over "available".
export function resolveAvailabilityForDate({ date, weeklySchedule, overrides = [], appointments = [], now = new Date() }) {
  const nowMs = now.getTime()
  const base = new Set((weeklySchedule || {})[WEEKDAYS[weekdayIndex(date)]] || [])

  const decided = new Map() // time -> { level, available }
  for (const rule of overrides) {
    if (!overrideAppliesToDate(rule, date)) continue
    const level = PRIORITY[rule.type] || 3
    for (const time of overrideSlotTimes(rule)) {
      const prev = decided.get(time)
      if (!prev || level < prev.level || (level === prev.level && !rule.available)) {
        decided.set(time, { level, available: Boolean(rule.available) })
      }
    }
  }

  const starts = slotStartsForDate(date)
  const booked = new Set()
  for (const appt of appointments) {
    if (appt.status === "cancelled") continue
    for (const time of occupiedSlotTimes(appt, date, starts)) booked.add(time)
  }

  return DAILY_SLOTS.map((time) => {
    const startDate = starts.get(time)
    const slot = {
      time,
      start: startDate ? startDate.toISOString() : null,
      end: startDate ? new Date(startDate.getTime() + SLOT_INTERVAL_MINUTES * 60000).toISOString() : null,
      available: false,
    }
    if (!startDate) return { ...slot, reason: "nonexistent_time" }
    if (startDate.getTime() <= nowMs) return { ...slot, reason: "past" }
    if (booked.has(time)) return { ...slot, reason: "already_booked" }
    const rule = decided.get(time)
    if (rule) return rule.available ? { ...slot, available: true } : { ...slot, reason: "admin_disabled" }
    return base.has(time) ? { ...slot, available: true } : { ...slot, reason: "outside_schedule" }
  })
}

// The slots a booking of `durationMinutes` starting at `time` needs.
export function slotsForBooking(time, durationMinutes) {
  const count = Math.max(1, Math.ceil(durationMinutes / SLOT_INTERVAL_MINUTES))
  const first = timeToMinutes(time)
  const out = []
  for (let i = 0; i < count; i++) {
    const m = first + i * SLOT_INTERVAL_MINUTES
    if (m >= 24 * 60) return null // runs past midnight — not supported by the slot model
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`)
  }
  return out
}

// Whether a booking fits entirely inside available slots of a resolved day.
export function isSlotAvailable(resolvedSlots, time, durationMinutes = SLOT_INTERVAL_MINUTES) {
  const needed = slotsForBooking(time, durationMinutes)
  if (!needed) return { available: false, reason: "outside_schedule" }
  const byTime = new Map(resolvedSlots.map((s) => [s.time, s]))
  for (const t of needed) {
    const slot = byTime.get(t)
    if (!slot?.available) return { available: false, reason: slot?.reason || "outside_schedule" }
  }
  return { available: true }
}

export { getNorwayNow }
