import { NextResponse } from "next/server"
import mongoose from "mongoose"
import { withApiErrors } from "@/lib/auth"
import { resolveDate } from "@/lib/appointments/availabilityService"

// Calculated booking availability for one Europe/Oslo date — all 48 slots,
// each with `available` and (when not) a `reason`: past, already_booked,
// admin_disabled, outside_schedule or nonexistent_time (the DST gap). Times
// are normalized "HH:MM"; the client only formats them. Public read: it
// reveals nothing about who booked what, and booking itself still requires
// a logged-in account.
export const GET = withApiErrors(async (request) => {
  const sp = new URL(request.url).searchParams
  const date = sp.get("date")
  // `exclude`: when rescheduling, treat that appointment's own slots as free.
  // Harmless to expose — booking and rescheduling re-check everything.
  const exclude = sp.get("exclude")
  const result = await resolveDate(date, new Date(), { excludeId: mongoose.isValidObjectId(exclude) ? exclude : null })
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
})
