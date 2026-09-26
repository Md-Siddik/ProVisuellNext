import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { getAvailabilitySettings, updateWeeklySchedule } from "@/lib/appointments/availabilityService"

// The weekly base schedule — owner and administrator share one configuration.
export const GET = withApiErrors(async (request) => {
  requirePermission(await authenticate(request), "appointments.manageAvailability")
  return NextResponse.json({ settings: await getAvailabilitySettings() })
})

export const PUT = withApiErrors(async (request) => {
  const { user } = requirePermission(await authenticate(request), "appointments.manageAvailability")
  const { weeklySchedule } = (await request.json().catch(() => ({}))) || {}
  return NextResponse.json({ settings: await updateWeeklySchedule(weeklySchedule, user._id) })
})
