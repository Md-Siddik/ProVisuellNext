import { NextResponse } from "next/server"
import mongoose from "mongoose"
import { authenticate, withApiErrors, ApiError } from "@/lib/auth"
import { can } from "@/lib/access"
import { Appointment } from "@/lib/models/Appointment"
import { rescheduleAppointment } from "@/lib/appointments/availabilityService"
import { customerCanReschedule, withAttendance } from "@/lib/appointments/attendance"
import { notifyAppointmentChange } from "@/lib/appointments/notifications"

// Move an appointment to a new Oslo date/time. Body: { date: "YYYY-MM-DD", time: "HH:MM" }.
//  - Staff with appointments.reschedule: any time, any free slot.
//  - The customer who booked it: only while at least one full hour remains
//    before the current start (server clock), and only to a slot the
//    booking rules allow.
// The same appointment document is updated — the order/customer links stay.
export const POST = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const auth = await authenticate(request)
  const { user } = auth
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Appointment not found")
  const appointment = await Appointment.findById(id)
  if (!appointment) throw new ApiError(404, "Appointment not found")

  const isStaff = can(auth, "appointments.reschedule")
  const isOwner = String(appointment.requestedBy) === String(user._id)
  if (!isStaff && !isOwner) throw new ApiError(404, "Appointment not found")
  if (appointment.status === "cancelled") throw new ApiError(409, "This meeting was cancelled.", "MEETING_CANCELLED")
  if (!isStaff && !customerCanReschedule(appointment)) {
    throw new ApiError(409, "Appointments can only be rescheduled at least 1 hour before they start.", "RESCHEDULE_CLOSED")
  }

  const { date, time } = (await request.json().catch(() => ({}))) || {}
  const previousStart = appointment.start
  await rescheduleAppointment({ appointment, date, time, enforceRules: !isStaff })

  notifyAppointmentChange(appointment, { kind: "rescheduled", byCustomer: !isStaff, previousStart })
  return NextResponse.json({ appointment: withAttendance(appointment) })
})
