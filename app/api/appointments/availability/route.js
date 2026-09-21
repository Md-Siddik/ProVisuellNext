import { NextResponse } from "next/server"
import { authenticate, withApiErrors, ApiError } from "@/lib/auth"
import { Appointment } from "@/lib/models/Appointment"

const SLOT_MINUTES = 30
const BOOKING_START_HOUR = 9
const BOOKING_END_HOUR = 17

// Real available time slots for a given day, so customers pick an open slot
// instead of typing in any time they like. Any logged-in user can check
// this (it's what powers the public booking widget).
export const GET = withApiErrors(async (request) => {
  await authenticate(request)

  const date = new URL(request.url).searchParams.get("date")
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ApiError(400, "date is required as YYYY-MM-DD")
  }

  const dayStart = new Date(`${date}T00:00:00`)
  const dayEnd = new Date(`${date}T23:59:59.999`)
  const existing = await Appointment.find({
    start: { $lte: dayEnd },
    end: { $gte: dayStart },
    status: { $ne: "cancelled" },
  })

  const now = new Date()
  const slots = []
  for (let hour = BOOKING_START_HOUR; hour < BOOKING_END_HOUR; hour++) {
    for (let minute = 0; minute < 60; minute += SLOT_MINUTES) {
      const start = new Date(dayStart)
      start.setHours(hour, minute, 0, 0)
      const end = new Date(start.getTime() + SLOT_MINUTES * 60000)
      const isPast = start < now
      const isTaken = existing.some((a) => start < new Date(a.end) && end > new Date(a.start))
      slots.push({ start: start.toISOString(), end: end.toISOString(), available: !isPast && !isTaken })
    }
  }
  return NextResponse.json({ slots })
})
