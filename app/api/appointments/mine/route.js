import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"
import { Appointment } from "@/lib/models/Appointment"
import { withAttendance } from "@/lib/appointments/attendance"

const RECENT_DAYS = 30

// The logged-in customer's own appointments: upcoming ones plus those that
// ended in the last 30 days (so they can see "Joined" / "Missed").
// "completed" ones (their linked order has been decided) are left out —
// they've served their purpose.
export const GET = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  const since = new Date(Date.now() - RECENT_DAYS * 86400000)
  const appointments = await Appointment.find({
    requestedBy: user._id,
    status: { $ne: "completed" },
    end: { $gte: since },
  }).sort({ start: 1 })
  // serverTime lets the page enable "Join" by the server's clock rather than
  // the visitor's (the join endpoint enforces it regardless).
  return NextResponse.json(
    { appointments: appointments.map((a) => withAttendance(a)), serverTime: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  )
})
