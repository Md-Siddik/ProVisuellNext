import { NextResponse } from "next/server"
import { withApiErrors } from "@/lib/auth"
import { resolveDate } from "@/lib/appointments/availabilityService"

// Calculated booking availability for one Europe/Oslo date — all 48 slots,
// each with `available` and (when not) a `reason`: past, already_booked,
// admin_disabled, outside_schedule or nonexistent_time (the DST gap). Times
// are normalized "HH:MM"; the client only formats them. Public read: it
// reveals nothing about who booked what, and booking itself still requires
// a logged-in account.
export const GET = withApiErrors(async (request) => {
  const date = new URL(request.url).searchParams.get("date")
  const result = await resolveDate(date)
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
})
