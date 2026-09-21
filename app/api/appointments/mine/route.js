import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"
import { Appointment } from "@/lib/models/Appointment"

// The logged-in customer's own booked appointments. "completed" ones (their
// linked order has been decided) are left out — they've served their
// purpose and the customer no longer needs to see or join them.
export const GET = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  const appointments = await Appointment.find({
    requestedBy: user._id,
    status: { $ne: "completed" },
  }).sort({ start: 1 })
  return NextResponse.json({ appointments })
})
