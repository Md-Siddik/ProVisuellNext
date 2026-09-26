import { NextResponse } from "next/server"
import mongoose from "mongoose"
import { authenticate, withApiErrors, ApiError } from "@/lib/auth"
import { can } from "@/lib/access"
import { Appointment } from "@/lib/models/Appointment"
import { STAFF_JOIN_EARLY_MINUTES, joinWindow, withAttendance } from "@/lib/appointments/attendance"
import { meetingRoomUrl } from "@/lib/meeting"

// The attendee pressed "Join". This is the ONLY place a customer can get the
// meeting URL: it's released here, and only while the meeting is open by the
// server's clock (customers from the start time, staff hosts 15 minutes
// early). Opening or refreshing a page never reaches this.
//
// Records attendance for the booked attendee (the customer who requested
// it; for internal meetings, the staff member joining). Staff hosts joining
// a customer's meeting are allowed through but don't count as the
// customer's attendance. Repeated clicks keep the first joinedAt.
export const PATCH = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const auth = await authenticate(request)
  const { user } = auth
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Appointment not found")

  const appointment = await Appointment.findById(id).select("+meetingUrl")
  if (!appointment) throw new ApiError(404, "Appointment not found")

  const isAttendee = String(appointment.requestedBy) === String(user._id)
  const isInternal = !appointment.requestedBy
  const isHost = can(auth, "appointments.view")
  if (!isAttendee && !isHost) throw new ApiError(404, "Appointment not found")

  if (appointment.status === "cancelled") throw new ApiError(409, "This meeting was cancelled.", "MEETING_CANCELLED")
  const window = joinWindow(appointment, new Date(), isHost && !isAttendee ? STAFF_JOIN_EARLY_MINUTES : 0)
  if (window === "too_early") throw new ApiError(409, "The meeting hasn't started yet.", "MEETING_NOT_STARTED")
  if (window === "ended") throw new ApiError(409, "This meeting has already ended.", "MEETING_ENDED")

  const meetingUrl = appointment.meetingUrl || meetingRoomUrl()
  if (!meetingUrl) throw new ApiError(503, "No meeting link is configured.", "NO_MEETING_LINK")

  let updated = appointment
  if (isAttendee || isInternal) {
    // Atomic and idempotent: only the first Join sets joinedAt.
    updated =
      (await Appointment.findOneAndUpdate(
        { _id: appointment._id, joinedAt: null },
        { $set: { joinedAt: new Date(), joinClicked: true, attendanceStatus: "joined", joinedBy: user._id } },
        { new: true }
      )) || (await Appointment.findById(appointment._id))
  }

  return NextResponse.json(
    { appointment: withAttendance(updated), recorded: isAttendee || isInternal, meetingUrl },
    { headers: { "Cache-Control": "no-store" } }
  )
})
