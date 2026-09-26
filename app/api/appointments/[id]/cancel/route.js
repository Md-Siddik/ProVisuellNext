import { NextResponse } from "next/server"
import mongoose from "mongoose"
import { authenticate, withApiErrors, ApiError } from "@/lib/auth"
import { can } from "@/lib/access"
import { Appointment } from "@/lib/models/Appointment"
import { releaseLocksForAppointment } from "@/lib/appointments/availabilityService"
import { customerCanCancel } from "@/lib/appointments/attendance"
import { notifyAppointmentChange } from "@/lib/appointments/notifications"

// Cancel an appointment.
//  - Staff with appointments.cancel: any time.
//  - The customer who booked it: only before it starts (server clock).
export const PATCH = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const auth = await authenticate(request)
  const { user } = auth
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Appointment not found")
  const appointment = await Appointment.findById(id)
  if (!appointment) throw new ApiError(404, "Appointment not found")

  const isStaff = can(auth, "appointments.cancel")
  const isOwner = String(appointment.requestedBy) === String(user._id)
  if (!isStaff && !isOwner) throw new ApiError(404, "Appointment not found")
  if (appointment.status === "cancelled") return NextResponse.json({ appointment })
  if (!isStaff && !customerCanCancel(appointment)) {
    throw new ApiError(409, "This appointment has already started and can't be cancelled.", "CANCEL_CLOSED")
  }

  appointment.status = "cancelled"
  appointment.cancelledAt = new Date()
  appointment.cancelledBy = user._id
  await appointment.save()
  // Frees its slots for booking again.
  await releaseLocksForAppointment(appointment._id)

  notifyAppointmentChange(appointment, { kind: "cancelled", byCustomer: !isStaff })
  return NextResponse.json({ appointment })
})
