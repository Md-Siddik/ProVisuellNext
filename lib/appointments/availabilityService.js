import crypto from "node:crypto"
import { ApiError } from "../apiError.js"
import { connectDB } from "../db.js"
import { Appointment } from "../models/Appointment.js"
import { AppointmentSlotLock } from "../models/AppointmentSlotLock.js"
import { AvailabilityOverride } from "../models/AvailabilityOverride.js"
import { AvailabilitySettings } from "../models/AvailabilitySettings.js"
import { OVERRIDE_TYPES, defaultWeeklySchedule, isSlotAvailable, resolveAvailabilityForDate, slotsForBooking } from "./rules.js"
import {
  BUSINESS_TIMEZONE,
  DAILY_SLOTS,
  SLOT_INTERVAL_MINUTES,
  WEEKDAYS,
  addDays,
  getNorwayNow,
  isValidDateString,
  normalizeAppointmentTime,
  osloParts,
  osloToUtc,
} from "./time.js"

// Server side of the booking availability engine: loads the stored rules,
// resolves a date with lib/appointments/rules.js, and books slots safely.
// The backend is the source of truth — the booking modal's slot list is
// only ever a hint, and every booking is re-checked here.

export const SLOT_UNAVAILABLE_MESSAGE = "This appointment time is no longer available."

export function slotUnavailable() {
  return new ApiError(409, SLOT_UNAVAILABLE_MESSAGE, "SLOT_UNAVAILABLE")
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

// A weekday never saved yet falls back to all 48 slots open; an empty list
// means the day is closed.
function completeSchedule(stored) {
  const defaults = defaultWeeklySchedule()
  return Object.fromEntries(WEEKDAYS.map((day) => [day, Array.isArray(stored?.[day]) ? stored[day] : defaults[day]]))
}

export async function getAvailabilitySettings() {
  await connectDB()
  const doc = await AvailabilitySettings.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: { key: "default", timezone: BUSINESS_TIMEZONE, slotIntervalMinutes: SLOT_INTERVAL_MINUTES, weeklySchedule: defaultWeeklySchedule() } },
    { upsert: true, new: true }
  ).lean()
  return {
    timezone: BUSINESS_TIMEZONE,
    slotIntervalMinutes: SLOT_INTERVAL_MINUTES,
    weeklySchedule: completeSchedule(doc.weeklySchedule),
    updatedAt: doc.updatedAt,
    updatedBy: doc.updatedBy,
  }
}

function cleanSlotList(list) {
  if (!Array.isArray(list)) throw new ApiError(400, "Invalid weekly schedule")
  const set = new Set()
  for (const value of list) {
    const time = normalizeAppointmentTime(value)
    if (!time || !DAILY_SLOTS.includes(time)) throw new ApiError(400, "Invalid weekly schedule")
    set.add(time)
  }
  return DAILY_SLOTS.filter((t) => set.has(t))
}

export async function updateWeeklySchedule(input, userId) {
  if (!input || typeof input !== "object") throw new ApiError(400, "Invalid weekly schedule")
  const weeklySchedule = Object.fromEntries(WEEKDAYS.map((day) => [day, cleanSlotList(input[day])]))
  await connectDB()
  await AvailabilitySettings.findOneAndUpdate(
    { key: "default" },
    { $set: { weeklySchedule, updatedBy: userId, timezone: BUSINESS_TIMEZONE, slotIntervalMinutes: SLOT_INTERVAL_MINUTES } },
    { upsert: true }
  )
  return getAvailabilitySettings()
}

// ---------------------------------------------------------------------------
// Overrides
// ---------------------------------------------------------------------------

// Validates and normalizes an override from the dashboard form.
export function cleanOverride(input) {
  const body = input || {}
  const type = String(body.type || "")
  if (!OVERRIDE_TYPES.includes(type)) throw new ApiError(400, "Invalid override type")

  const date = (v) => {
    if (v == null || v === "") return null
    if (!isValidDateString(v)) throw new ApiError(400, "Invalid date")
    return v
  }
  let startDate = date(body.startDate)
  let endDate = date(body.endDate)
  let daysOfWeek = []

  if (type === "single_date") {
    if (!startDate) throw new ApiError(400, "A date is required")
    endDate = startDate
  } else if (type === "date_range" || type === "week" || type === "month") {
    if (!startDate || !endDate) throw new ApiError(400, "A start and end date are required")
  } else if (type === "weekly_recurring") {
    daysOfWeek = [...new Set((Array.isArray(body.daysOfWeek) ? body.daysOfWeek : []).map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort()
    if (daysOfWeek.length === 0) throw new ApiError(400, "Pick at least one weekday")
  }
  if (startDate && endDate && endDate < startDate) throw new ApiError(400, "The end date is before the start date")

  const allDay = Boolean(body.allDay)
  let startTime = null
  let endTime = null
  let slotTimes = []
  if (!allDay) {
    if (Array.isArray(body.slotTimes) && body.slotTimes.length) {
      slotTimes = cleanSlotList(body.slotTimes)
    } else {
      startTime = normalizeAppointmentTime(body.startTime)
      endTime = normalizeAppointmentTime(body.endTime)
      if (!startTime || !endTime || !DAILY_SLOTS.includes(startTime) || !DAILY_SLOTS.includes(endTime)) {
        throw new ApiError(400, "Pick the whole day, a time range, or individual slots")
      }
      if (endTime < startTime) throw new ApiError(400, "The end time is before the start time")
    }
  }

  return {
    type,
    startDate,
    endDate,
    daysOfWeek,
    allDay,
    startTime,
    endTime,
    slotTimes,
    available: Boolean(body.available),
    active: body.active === undefined ? true : Boolean(body.active),
    note: String(body.note || "").slice(0, 200),
  }
}

// Active rules that could touch `date` (the date/weekday check itself is in rules.js).
async function overridesForDate(date) {
  return AvailabilityOverride.find({
    active: true,
    $and: [{ $or: [{ startDate: null }, { startDate: { $lte: date } }] }, { $or: [{ endDate: null }, { endDate: { $gte: date } }] }],
  }).lean()
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

async function appointmentsTouchingDate(date) {
  const dayStart = osloToUtc(date, "00:00")
  const dayEnd = osloToUtc(addDays(date, 1), "00:00")
  return Appointment.find({ start: { $lt: dayEnd }, end: { $gt: dayStart }, status: { $ne: "cancelled" } })
    .select("start end status")
    .lean()
}

export async function resolveDate(date, now = new Date()) {
  if (!isValidDateString(date)) throw new ApiError(400, "date is required as YYYY-MM-DD")
  const settings = await getAvailabilitySettings()
  const [overrides, appointments] = await Promise.all([overridesForDate(date), appointmentsTouchingDate(date)])
  const slots = resolveAvailabilityForDate({ date, weeklySchedule: settings.weeklySchedule, overrides, appointments, now })
  return {
    timezone: BUSINESS_TIMEZONE,
    date,
    slotIntervalMinutes: SLOT_INTERVAL_MINUTES,
    now: getNorwayNow(now),
    slots,
  }
}

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------

let lockIndexReady = null
function ensureLockIndex() {
  // The unique index is the whole point of the lock collection — make sure
  // it exists before relying on it (autoIndex may be off in production).
  if (!lockIndexReady) lockIndexReady = AppointmentSlotLock.init().catch((err) => ((lockIndexReady = null), Promise.reject(err)))
  return lockIndexReady
}

// A lock whose appointment was cancelled or deleted outside this flow
// shouldn't block the slot forever.
async function clearStaleLock(slotStart) {
  const lock = await AppointmentSlotLock.findOne({ slotStart }).lean()
  if (!lock) return true
  // Locks without an appointment belong to an attempt still in flight (or
  // one that crashed) — only treat them as stale after a minute.
  if (!lock.appointment) {
    if (Date.now() - new Date(lock.createdAt).getTime() < 60000) return false
  } else {
    const appt = await Appointment.findById(lock.appointment).select("status").lean()
    if (appt && appt.status !== "cancelled") return false
  }
  await AppointmentSlotLock.deleteOne({ _id: lock._id })
  return true
}

async function acquireLocks(slotStarts, token) {
  for (const slotStart of slotStarts) {
    for (let attempt = 0; ; attempt++) {
      try {
        await AppointmentSlotLock.create({ slotStart, token })
        break
      } catch (err) {
        if (err?.code !== 11000 || attempt > 0 || !(await clearStaleLock(slotStart))) {
          await AppointmentSlotLock.deleteMany({ token })
          if (err?.code === 11000) throw slotUnavailable()
          throw err
        }
      }
    }
  }
}

export async function releaseLocksForAppointment(appointmentId) {
  await connectDB()
  await AppointmentSlotLock.deleteMany({ appointment: appointmentId })
}

// Books `durationMinutes` from an Oslo date + time. Re-checks availability
// right now (never trusting the list the client fetched earlier), then takes
// the per-slot locks, then creates the appointment via `create(start, end)`.
export async function bookSlot({ date, time, durationMinutes = SLOT_INTERVAL_MINUTES, create }) {
  const normalized = normalizeAppointmentTime(time)
  if (!isValidDateString(date) || !normalized || !DAILY_SLOTS.includes(normalized)) throw slotUnavailable()
  const needed = slotsForBooking(normalized, durationMinutes)
  if (!needed) throw slotUnavailable()

  const resolved = await resolveDate(date)
  if (!isSlotAvailable(resolved.slots, normalized, durationMinutes).available) throw slotUnavailable()

  const starts = needed.map((t) => osloToUtc(date, t))
  if (starts.some((s) => !s)) throw slotUnavailable()
  const start = starts[0]
  const end = new Date(start.getTime() + durationMinutes * 60000)

  await ensureLockIndex()
  const token = crypto.randomUUID()
  await acquireLocks(starts, token)

  try {
    // Appointments made outside this flow (staff meetings, older bookings)
    // have no locks — check the appointments themselves once more now that
    // this attempt holds its slots.
    const overlap = await Appointment.exists({ start: { $lt: end }, end: { $gt: start }, status: { $ne: "cancelled" } })
    if (overlap) throw slotUnavailable()

    const appointment = await create(start, end)
    await AppointmentSlotLock.updateMany({ token }, { $set: { appointment: appointment._id } })
    return appointment
  } catch (err) {
    await AppointmentSlotLock.deleteMany({ token })
    throw err
  }
}

// Legacy request shape ({ start, end } as ISO instants) → Oslo date/time/duration.
export function bookingFromInstants(start, end) {
  const s = new Date(start)
  const e = new Date(end)
  if (Number.isNaN(s.getTime())) return null
  const { date, time } = osloParts(s)
  const minutes = Number.isNaN(e.getTime()) ? SLOT_INTERVAL_MINUTES : Math.round((e - s) / 60000)
  return { date, time, durationMinutes: minutes }
}
