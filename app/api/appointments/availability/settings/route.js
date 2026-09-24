import { NextResponse } from "next/server"
import { authenticate, requireRole, withApiErrors } from "@/lib/auth"
import { getAvailabilitySettings, updateWeeklySchedule } from "@/lib/appointments/availabilityService"

const STAFF = ["owner", "administrator"]

// The weekly base schedule — owner and administrator share one configuration.
export const GET = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  requireRole(user, STAFF)
  return NextResponse.json({ settings: await getAvailabilitySettings() })
})

export const PUT = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  requireRole(user, STAFF)
  const { weeklySchedule } = (await request.json().catch(() => ({}))) || {}
  return NextResponse.json({ settings: await updateWeeklySchedule(weeklySchedule, user._id) })
})
