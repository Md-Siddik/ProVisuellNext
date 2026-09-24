// Database-backed booking tests: server-side validation, override effects and
// double-booking protection, run against a throwaway database on the same
// MongoDB cluster (never the real "ProVisuell" database). Dropped afterwards.
//
//   npm run test:db
import test, { after, before } from "node:test"
import assert from "node:assert/strict"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })
const TEST_DB = "provisuell_availability_test"
if (!process.env.MONGO_URI) throw new Error("MONGO_URI missing in .env.local")
// Swap the database name in the connection string for the test database.
process.env.MONGO_URI = process.env.MONGO_URI.replace(/(mongodb(?:\+srv)?:\/\/[^/]+)\/[^?]*/, `$1/${TEST_DB}`)

const mongoose = (await import("mongoose")).default
const { connectDB } = await import("../lib/db.js")
const { Appointment } = await import("../lib/models/Appointment.js")
const { AvailabilityOverride } = await import("../lib/models/AvailabilityOverride.js")
const { AppointmentSlotLock } = await import("../lib/models/AppointmentSlotLock.js")
const svc = await import("../lib/appointments/availabilityService.js")
const { addDays, getNorwayNow, osloToUtc } = await import("../lib/appointments/time.js")

const date = addDays(getNorwayNow().date, 3)
const create = (label) => (start, end) =>
  Appointment.create({ title: label, start, end, requestedByName: label, requestedByEmail: `${label}@example.test` })

before(async () => {
  await connectDB()
  assert.equal(mongoose.connection.name, TEST_DB, "refusing to run outside the test database")
  await mongoose.connection.dropDatabase()
})

after(async () => {
  if (mongoose.connection.name === TEST_DB) await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
})

test("default settings are created with all 48 slots every day", async () => {
  const settings = await svc.getAvailabilitySettings()
  assert.equal(settings.timezone, "Europe/Oslo")
  for (const slots of Object.values(settings.weeklySchedule)) assert.equal(slots.length, 48)
  const day = await svc.resolveDate(date)
  assert.equal(day.slots.filter((s) => s.available).length, 48)
})

test("booking stores the exact Oslo instant", async () => {
  const appt = await svc.bookSlot({ date, time: "15:30", create: create("a") })
  assert.equal(new Date(appt.start).toISOString(), osloToUtc(date, "15:30").toISOString())
  assert.equal(new Date(appt.end) - new Date(appt.start), 30 * 60000)
  const day = await svc.resolveDate(date)
  assert.equal(day.slots.find((s) => s.time === "15:30").reason, "already_booked")
})

test("TEST 14 — simultaneous requests for one slot: exactly one succeeds", async () => {
  const attempts = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => svc.bookSlot({ date, time: "10:00", create: create(`race${i}`) })))
  const ok = attempts.filter((a) => a.status === "fulfilled")
  const failed = attempts.filter((a) => a.status === "rejected")
  assert.equal(ok.length, 1)
  assert.ok(failed.every((f) => f.reason.code === "SLOT_UNAVAILABLE"), failed.map((f) => f.reason.message).join(","))
  assert.equal(await Appointment.countDocuments({ start: osloToUtc(date, "10:00") }), 1)
})

test("overlapping durations race: 60-min vs 30-min on a shared slot", async () => {
  const results = await Promise.allSettled([
    svc.bookSlot({ date, time: "12:00", durationMinutes: 60, create: create("long") }),
    svc.bookSlot({ date, time: "12:30", create: create("short") }),
  ])
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1)
})

test("staff/legacy appointments without locks still block bookings", async () => {
  await Appointment.create({ title: "internal", start: osloToUtc(date, "18:15"), end: osloToUtc(date, "18:45"), requestedByName: "x", requestedByEmail: "x@example.test" })
  await assert.rejects(svc.bookSlot({ date, time: "18:00", create: create("b") }), { code: "SLOT_UNAVAILABLE" })
  await assert.rejects(svc.bookSlot({ date, time: "18:30", create: create("b") }), { code: "SLOT_UNAVAILABLE" })
})

test("admin-disabled and past slots are rejected server-side", async () => {
  const rule = await AvailabilityOverride.create(svc.cleanOverride({ type: "single_date", startDate: date, slotTimes: ["09:30"] }))
  await assert.rejects(svc.bookSlot({ date, time: "09:30", create: create("c") }), { code: "SLOT_UNAVAILABLE" })
  // Deactivating the rule re-opens the slot.
  rule.active = false
  await rule.save()
  await svc.bookSlot({ date, time: "09:30", create: create("c") })

  const yesterday = addDays(getNorwayNow().date, -1)
  await assert.rejects(svc.bookSlot({ date: yesterday, time: "12:00", create: create("d") }), { code: "SLOT_UNAVAILABLE" })
})

test("cancelling releases the slot; a stale lock doesn't block forever", async () => {
  const appt = await svc.bookSlot({ date, time: "20:00", create: create("e") })
  appt.status = "cancelled"
  await appt.save()
  await svc.releaseLocksForAppointment(appt._id)
  await svc.bookSlot({ date, time: "20:00", create: create("f") })

  // Appointment cancelled without releasing its lock (e.g. edited directly in the DB).
  const stale = await svc.bookSlot({ date, time: "21:00", create: create("g") })
  await Appointment.updateOne({ _id: stale._id }, { status: "cancelled" })
  assert.equal(await AppointmentSlotLock.countDocuments({ appointment: stale._id }), 1)
  await svc.bookSlot({ date, time: "21:00", create: create("h") })
})

test("override validation rejects bad input", () => {
  assert.throws(() => svc.cleanOverride({ type: "nope" }))
  assert.throws(() => svc.cleanOverride({ type: "single_date", allDay: true }))
  assert.throws(() => svc.cleanOverride({ type: "date_range", startDate: "2026-10-15", endDate: "2026-10-10", allDay: true }))
  assert.throws(() => svc.cleanOverride({ type: "weekly_recurring", daysOfWeek: [], allDay: true }))
  assert.throws(() => svc.cleanOverride({ type: "single_date", startDate: "2026-10-05", startTime: "11:00", endTime: "09:00" }))
  assert.throws(() => svc.cleanOverride({ type: "single_date", startDate: "2026-10-05", slotTimes: ["09:15"] }))
  const ok = svc.cleanOverride({ type: "single_date", startDate: "2026-10-05", startTime: "3:00 PM", endTime: "17:00" })
  assert.deepEqual([ok.startTime, ok.endTime, ok.endDate], ["15:00", "17:00", "2026-10-05"])
})
