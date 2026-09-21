import { NextResponse } from "next/server"
import { authenticate, withApiErrors, ApiError } from "@/lib/auth"
import { Appointment } from "@/lib/models/Appointment"

// The customer clicked "Bli med" and joined the meeting — it's done, so it
// drops off "Mine avtaler" immediately rather than waiting on an order to
// be decided later.
export const PATCH = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const { user } = await authenticate(request)
  const appointment = await Appointment.findOne({ _id: id, requestedBy: user._id })
  if (!appointment) throw new ApiError(404, "Appointment not found")
  if (appointment.status === "scheduled") {
    appointment.status = "completed"
    await appointment.save()
  }
  return NextResponse.json({ appointment })
})
