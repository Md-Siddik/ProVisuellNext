import { NextResponse } from "next/server"
import { authenticate, requireRole, withApiErrors, ApiError } from "@/lib/auth"
import { Appointment } from "@/lib/models/Appointment"
import { releaseLocksForAppointment } from "@/lib/appointments/availabilityService"

export const PATCH = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const { user } = await authenticate(request)
  requireRole(user, ["administrator", "owner"])
  const appointment = await Appointment.findByIdAndUpdate(id, { status: "cancelled" }, { new: true })
  if (!appointment) throw new ApiError(404, "Appointment not found")
  // Frees its slots for booking again.
  await releaseLocksForAppointment(appointment._id)
  return NextResponse.json({ appointment })
})
