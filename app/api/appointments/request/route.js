import { NextResponse } from "next/server"
import { authenticate, withApiErrors, ApiError } from "@/lib/auth"
import { Appointment } from "@/lib/models/Appointment"
import { meetingRoomUrl } from "@/lib/meeting"
import { notifyRole } from "@/lib/notify"
import { notifyBusiness, sendEmail } from "@/lib/mailer"
import { bookSlot, bookingFromInstants, slotUnavailable } from "@/lib/appointments/availabilityService"
import { formatOsloDateTime } from "@/lib/appointments/time"

const MAX_DURATION_MINUTES = 180

// A logged-in customer requests a meeting slot from the marketing site's
// booking widget. Tied to their account so it shows up under "Mine avtaler".
//
// Body: { title, notes, date: "YYYY-MM-DD", time: "HH:MM", durationMinutes? }
// (Europe/Oslo). The older { start, end } ISO shape is still accepted.
// Availability is re-resolved on the server and the slots are locked
// atomically, so a stale list or two simultaneous requests can't double-book.
export const POST = withApiErrors(async (request) => {
  const { user } = await authenticate(request)

  const body = (await request.json().catch(() => ({}))) || {}
  const { title, notes } = body
  if (!title) throw new ApiError(400, "title, start and end are required")

  const slot = body.date && body.time
    ? { date: body.date, time: body.time, durationMinutes: Number(body.durationMinutes) || 30 }
    : body.start
      ? bookingFromInstants(body.start, body.end)
      : null
  if (!slot) throw new ApiError(400, "title, start and end are required")
  const { durationMinutes } = slot
  if (!Number.isInteger(durationMinutes) || durationMinutes < 30 || durationMinutes > MAX_DURATION_MINUTES || durationMinutes % 30 !== 0) {
    throw slotUnavailable()
  }

  const appointment = await bookSlot({
    ...slot,
    create: (start, end) =>
      Appointment.create({
        title: String(title).slice(0, 200),
        start,
        end,
        requestedByName: user.name || user.email,
        requestedByEmail: user.email,
        requestedBy: user._id,
        notes: notes ? String(notes).slice(0, 2000) : "",
        // Kept server-side; released only by the join endpoint at meeting time.
        meetingUrl: meetingRoomUrl(),
      }),
  })

  // Norwegian-language messages, in Norwegian time (not the server's zone).
  const when = `${formatOsloDateTime(appointment.start, "no-NO", "24h")} (norsk tid)`
  const message = `${appointment.requestedByName} — ${when}`
  notifyRole("owner", {
    type: "appointment_booked",
    title: "Ny avtale booket",
    message,
    link: "/dashboard/owner/ansattmoter",
  })
  notifyRole("administrator", {
    type: "appointment_booked",
    title: "Ny avtale booket",
    message,
    link: "/dashboard/admin/ansattmoter",
  })
  notifyRole("moderator", {
    type: "appointment_booked",
    title: "Ny avtale booket",
    message,
    link: "/dashboard/admin/ansattmoter",
  })

  // Best-effort booking confirmation to the customer, plus a heads-up to
  // the business inbox — both silently skipped if SMTP isn't configured.
  if (appointment.requestedByEmail) {
    sendEmail({
      to: appointment.requestedByEmail,
      subject: `Møtet ditt er booket — ${when}`,
      text: `Hei ${appointment.requestedByName},\n\nMøtet ditt "${appointment.title}" er booket til ${when}.${appointment.notes ? `\n\nNotat: ${appointment.notes}` : ""}\n\nDu finner møtet under "Mine avtaler" på din side.\n\nMvh ProVisuell`,
    })
  }
  notifyBusiness({
    subject: `Ny avtale booket — ${appointment.requestedByName}`,
    text: `Kunde: ${appointment.requestedByName}\nE-post: ${appointment.requestedByEmail || "—"}\nTidspunkt: ${when}\nTittel: ${appointment.title}${appointment.notes ? `\nNotat: ${appointment.notes}` : ""}`,
  })

  // Never echo the meeting URL back — it's only released at join time.
  const { meetingUrl: _omit, ...safe } = appointment.toObject()
  return NextResponse.json({ appointment: safe }, { status: 201 })
})
