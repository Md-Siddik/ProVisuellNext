// Pure tests for the slot engine, Europe/Oslo conversion and 12h/24h
// formatting. No database, no network. Run with `npm test` — also under a
// foreign TZ (e.g. TZ=Asia/Dhaka) to prove nothing depends on the machine's zone.
import test from "node:test"
import assert from "node:assert/strict"
import {
  DAILY_SLOTS,
  formatAppointmentTime,
  formatOsloTime,
  generateDailySlots,
  getNorwayNow,
  groupSlots,
  monthBounds,
  normalizeAppointmentTime,
  osloToUtc,
  slotsInRange,
  startOfWeekDate,
  weekdayIndex,
} from "../lib/appointments/time.js"
import { defaultWeeklySchedule, isSlotAvailable, resolveAvailabilityForDate } from "../lib/appointments/rules.js"

const WEEKLY = defaultWeeklySchedule()
const LONG_AGO = new Date("2020-01-01T00:00:00Z")
const resolve = (date, extra = {}) => resolveAvailabilityForDate({ date, weeklySchedule: WEEKLY, now: LONG_AGO, ...extra })
const slot = (slots, time) => slots.find((s) => s.time === time)
const rule = (r) => ({ active: true, available: false, daysOfWeek: [], slotTimes: [], allDay: false, startDate: null, endDate: null, ...r })
const osloAppt = (date, from, to, status = "scheduled") => ({ start: osloToUtc(date, from), end: osloToUtc(date, to), status })

test("full day: 48 slots from 00:00 to 23:30, generated once", () => {
  const slots = generateDailySlots({ intervalMinutes: 30 })
  assert.equal(slots.length, 48)
  assert.equal(slots[0], "00:00")
  assert.equal(slots[1], "00:30")
  assert.equal(slots[47], "23:30")
  assert.deepEqual(DAILY_SLOTS, slots)
  assert.ok(slots.every((s) => /^\d{2}:\d{2}$/.test(s)))
})

test("12h / 24h formatting (presentation only)", () => {
  const cases = [
    ["00:00", "12:00 AM", "00:00"],
    ["00:30", "12:30 AM", "00:30"],
    ["01:00", "01:00 AM", "01:00"],
    ["08:30", "08:30 AM", "08:30"],
    ["12:00", "12:00 PM", "12:00"],
    ["12:30", "12:30 PM", "12:30"],
    ["15:00", "03:00 PM", "15:00"],
    ["15:30", "03:30 PM", "15:30"],
    ["18:30", "06:30 PM", "18:30"],
    ["23:30", "11:30 PM", "23:30"],
  ]
  for (const [time, h12, h24] of cases) {
    assert.equal(formatAppointmentTime(time, "12h"), h12, time)
    assert.equal(formatAppointmentTime(time, "24h"), h24, time)
  }
  // Default is 12-hour.
  assert.equal(formatAppointmentTime("15:30"), "03:30 PM")
})

test("normalization always yields canonical 24-hour values", () => {
  assert.equal(normalizeAppointmentTime("03:30 PM"), "15:30")
  assert.equal(normalizeAppointmentTime("12:00 AM"), "00:00")
  assert.equal(normalizeAppointmentTime("12:30 pm"), "12:30")
  assert.equal(normalizeAppointmentTime("9:05"), "09:05")
  assert.equal(normalizeAppointmentTime("24:00"), null)
  assert.equal(normalizeAppointmentTime("13:00 PM"), null)
  // Round trip: formatting then normalizing returns the stored value.
  for (const s of DAILY_SLOTS) assert.equal(normalizeAppointmentTime(formatAppointmentTime(s, "12h")), s)
})

test("switching format does not change resolved data", () => {
  const before = JSON.stringify(resolve("2030-06-03"))
  formatAppointmentTime("15:30", "24h")
  formatAppointmentTime("15:30", "12h")
  assert.equal(JSON.stringify(resolve("2030-06-03")), before)
  const selected = "15:30"
  assert.equal(formatAppointmentTime(selected, "12h"), "03:30 PM")
  assert.equal(formatAppointmentTime(selected, "24h"), "15:30")
})

test("Europe/Oslo: CET in winter, CEST in summer (never a fixed offset)", () => {
  assert.equal(osloToUtc("2026-01-15", "15:30").toISOString(), "2026-01-15T14:30:00.000Z")
  assert.equal(osloToUtc("2026-07-15", "15:30").toISOString(), "2026-07-15T13:30:00.000Z")
  assert.equal(osloToUtc("2026-12-31", "00:00").toISOString(), "2026-12-30T23:00:00.000Z")
  assert.equal(formatOsloTime("2026-07-15T13:30:00Z", "24h"), "15:30")
  assert.equal(formatOsloTime("2026-01-15T14:30:00Z", "12h"), "03:30 PM")
})

test("DST: spring-forward gap is not bookable, autumn day keeps 48 slots", () => {
  // 29 March 2026: 02:00 → 03:00.
  assert.equal(osloToUtc("2026-03-29", "02:00"), null)
  assert.equal(osloToUtc("2026-03-29", "02:30"), null)
  assert.equal(osloToUtc("2026-03-29", "01:30").toISOString(), "2026-03-29T00:30:00.000Z")
  assert.equal(osloToUtc("2026-03-29", "03:00").toISOString(), "2026-03-29T01:00:00.000Z")
  const spring = resolve("2026-03-29")
  assert.equal(spring.length, 48)
  assert.equal(slot(spring, "02:00").reason, "nonexistent_time")
  assert.equal(slot(spring, "02:30").available, false)
  assert.equal(spring.filter((s) => s.available).length, 46)
  // 25 October 2026: 03:00 → 02:00; the first (summer-time) 02:30 is used.
  assert.equal(osloToUtc("2026-10-25", "02:30").toISOString(), "2026-10-25T00:30:00.000Z")
  assert.equal(osloToUtc("2026-10-25", "03:00").toISOString(), "2026-10-25T02:00:00.000Z")
  assert.equal(resolve("2026-10-25").filter((s) => s.available).length, 48)
})

test("default schedule: every day, all 48 slots available", () => {
  for (const day of Object.values(WEEKLY)) assert.equal(day.length, 48)
  const all = resolve("2030-06-03")
  assert.equal(all.filter((s) => s.available).length, 48)
})

test("today: past slots use Oslo 'now' (15:17 → 15:00 unavailable, 15:30 open)", () => {
  const now = osloToUtc("2026-09-25", "15:17") // 13:17Z
  assert.equal(getNorwayNow(now).time, "15:17")
  const slots = resolve("2026-09-25", { now: new Date(now.getTime()) })
  assert.equal(slot(slots, "15:00").reason, "past")
  assert.equal(slot(slots, "00:00").reason, "past")
  assert.equal(slot(slots, "15:30").available, true)
  assert.equal(slot(slots, "23:30").available, true)
  // Yesterday is entirely past, tomorrow entirely open.
  assert.equal(resolve("2026-09-24", { now }).filter((s) => s.available).length, 0)
  assert.equal(resolve("2026-09-26", { now }).filter((s) => s.available).length, 48)
})

test("TEST 7 — single date + single slot disabled", () => {
  const overrides = [rule({ type: "single_date", startDate: "2026-10-05", endDate: "2026-10-05", slotTimes: ["09:30"] })]
  const day = resolve("2026-10-05", { overrides })
  assert.equal(slot(day, "09:30").available, false)
  assert.equal(slot(day, "09:30").reason, "admin_disabled")
  assert.equal(slot(day, "09:00").available, true)
  assert.equal(slot(resolve("2026-10-06", { overrides }), "09:30").available, true)
})

test("TEST 8 — every Monday 14:30, indefinitely", () => {
  const overrides = [rule({ type: "weekly_recurring", daysOfWeek: [0], slotTimes: ["14:30"] })]
  for (const monday of ["2026-09-28", "2026-10-05", "2027-03-01", "2031-12-29"]) {
    assert.equal(weekdayIndex(monday), 0)
    assert.equal(slot(resolve(monday, { overrides }), "14:30").available, false, monday)
  }
  assert.equal(slot(resolve("2026-09-29", { overrides }), "14:30").available, true)
})

test("TEST 9 — whole date closed (e.g. 25 December)", () => {
  const overrides = [rule({ type: "single_date", startDate: "2026-12-25", endDate: "2026-12-25", allDay: true })]
  assert.equal(resolve("2026-12-25", { overrides }).filter((s) => s.available).length, 0)
  assert.equal(resolve("2026-12-24", { overrides }).filter((s) => s.available).length, 48)
})

test("TEST 10 — date range, week and month rules", () => {
  const range = [rule({ type: "date_range", startDate: "2026-10-10", endDate: "2026-10-15", startTime: "09:00", endTime: "11:30" })]
  for (const d of ["2026-10-10", "2026-10-12", "2026-10-15"]) {
    const s = resolve(d, { overrides: range })
    assert.deepEqual(s.filter((x) => !x.available).map((x) => x.time), ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"], d)
  }
  assert.equal(resolve("2026-10-16", { overrides: range }).filter((s) => s.available).length, 48)

  const closed = [rule({ type: "date_range", startDate: "2026-12-20", endDate: "2026-12-31", allDay: true })]
  assert.equal(resolve("2026-12-27", { overrides: closed }).filter((s) => s.available).length, 0)
  assert.equal(resolve("2027-01-01", { overrides: closed }).filter((s) => s.available).length, 48)

  const monday = startOfWeekDate("2026-11-12")
  assert.equal(monday, "2026-11-09")
  const week = [rule({ type: "week", startDate: monday, endDate: "2026-11-15", allDay: true })]
  assert.equal(resolve("2026-11-15", { overrides: week }).filter((s) => s.available).length, 0)
  assert.equal(resolve("2026-11-16", { overrides: week }).filter((s) => s.available).length, 48)

  const { start, end } = monthBounds("2027-02-10")
  assert.deepEqual([start, end], ["2027-02-01", "2027-02-28"])
  const month = [rule({ type: "month", startDate: start, endDate: end, allDay: true })]
  assert.equal(resolve("2027-02-28", { overrides: month }).filter((s) => s.available).length, 0)
  assert.equal(resolve("2027-03-01", { overrides: month }).filter((s) => s.available).length, 48)
})

test("rules are reversible: an inactive rule no longer blocks", () => {
  const r = rule({ type: "weekly_recurring", daysOfWeek: [4], slotTimes: ["14:30"] })
  assert.equal(slot(resolve("2026-10-02", { overrides: [r] }), "14:30").available, false)
  assert.equal(slot(resolve("2026-10-02", { overrides: [{ ...r, active: false }] }), "14:30").available, true)
})

test("priority: booking > single date > period > recurring > weekly base", () => {
  const date = "2026-10-05" // Monday
  const recurringOff = rule({ type: "weekly_recurring", daysOfWeek: [0], slotTimes: ["10:00"] })
  const periodOn = rule({ type: "date_range", startDate: "2026-10-01", endDate: "2026-10-31", slotTimes: ["10:00"], available: true })
  const periodOff = rule({ type: "date_range", startDate: "2026-10-01", endDate: "2026-10-31", slotTimes: ["10:00"] })
  const singleOn = rule({ type: "single_date", startDate: date, endDate: date, slotTimes: ["10:00"], available: true })
  const singleOff = rule({ type: "single_date", startDate: date, endDate: date, slotTimes: ["10:00"] })

  // Base on, recurring off → off.
  assert.equal(slot(resolve(date, { overrides: [recurringOff] }), "10:00").available, false)
  // Period on beats recurring off.
  assert.equal(slot(resolve(date, { overrides: [recurringOff, periodOn] }), "10:00").available, true)
  // Single-date on beats period off.
  assert.equal(slot(resolve(date, { overrides: [periodOff, singleOn] }), "10:00").available, true)
  // Single-date off beats period on.
  assert.equal(slot(resolve(date, { overrides: [periodOn, singleOff] }), "10:00").available, false)
  // Same level disagreeing → unavailable wins.
  assert.equal(slot(resolve(date, { overrides: [singleOn, singleOff] }), "10:00").available, false)
  // Weekly base off, single-date on → available.
  const closedMonday = { ...WEEKLY, monday: [] }
  assert.equal(slot(resolveAvailabilityForDate({ date, weeklySchedule: closedMonday, overrides: [singleOn], now: LONG_AGO }), "10:00").available, true)
  assert.equal(slot(resolveAvailabilityForDate({ date, weeklySchedule: closedMonday, now: LONG_AGO }), "10:00").reason, "outside_schedule")
  // A booking beats an "available" override.
  const booked = resolve(date, { overrides: [singleOn], appointments: [osloAppt(date, "10:00", "10:30")] })
  assert.equal(slot(booked, "10:00").reason, "already_booked")
})

test("TEST 11 + durations: bookings block every slot they occupy", () => {
  const date = "2026-10-07"
  const at14 = resolve(date, { appointments: [osloAppt(date, "14:00", "14:30")] })
  assert.equal(slot(at14, "14:00").reason, "already_booked")
  assert.equal(slot(at14, "14:30").available, true)
  assert.equal(formatAppointmentTime(slot(at14, "14:00").time, "12h"), "02:00 PM")

  const sixty = resolve(date, { appointments: [osloAppt(date, "10:00", "11:00")] })
  assert.deepEqual(sixty.filter((s) => !s.available).map((s) => s.time), ["10:00", "10:30"])
  const ninety = resolve(date, { appointments: [osloAppt(date, "10:00", "11:30")] })
  assert.deepEqual(ninety.filter((s) => !s.available).map((s) => s.time), ["10:00", "10:30", "11:00"])
  // Off-grid internal meeting touches two slots.
  const offGrid = resolve(date, { appointments: [osloAppt(date, "10:15", "10:45")] })
  assert.deepEqual(offGrid.filter((s) => !s.available).map((s) => s.time), ["10:00", "10:30"])
  // Cancelled appointments don't block.
  assert.equal(resolve(date, { appointments: [osloAppt(date, "14:00", "14:30", "cancelled")] }).filter((s) => s.available).length, 48)
  // A 60-minute booking needs both slots free.
  assert.equal(isSlotAvailable(at14, "13:30", 60).available, false)
  assert.equal(isSlotAvailable(at14, "14:30", 60).available, true)
  assert.equal(isSlotAvailable(at14, "23:30", 60).available, false) // would run past midnight
})

test("slot groups keep every slot and don't depend on format", () => {
  const groups = groupSlots(DAILY_SLOTS, (x) => x)
  assert.deepEqual(groups.map((g) => g.key), ["night", "morning", "afternoon", "evening"])
  assert.equal(groups.reduce((n, g) => n + g.items.length, 0), 48)
  assert.deepEqual(slotsInRange("08:00", "17:00").length, 19)
})
