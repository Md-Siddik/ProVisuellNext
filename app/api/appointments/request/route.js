import { NextResponse } from "next/server"
import { authenticate, withApiErrors, ApiError } from "@/lib/auth"
import { Appointment } from "@/lib/models/Appointment"
import { notifyRole } from "@/lib/notify"
import { notifyBusiness, sendEmail } from "@/lib/mailer"

// A logged-in customer requests a meeting slot from the marketing site's
// booking widget. Tied to their account so it shows up under "Mine avtaler".
export const POST = withApiErrors(async (request) => {
  const { user } = await authenticate(request)

  const { title, start, end, notes } = (await request.json().catch(() => ({}))) || {}
  if (!title || !start || !end) {
    throw new ApiError(400, "title, start and end are required")
  }

  // Re-check the slot is still free server-side — the client only ever
  // shows open slots, but two people could race for the same one.
  const overlap = await Appointment.findOne({
    start: { $lt: new Date(end) },
    end: { $gt: new Date(start) },
    status: { $ne: "cancelled" },
  })
  if (overlap) {
    throw new ApiError(409, "Dette tidspunktet er nettopp booket av noen andre. Velg et annet.")
  }

  const appointment = await Appointment.create({
    title,
    start,
    end,
    requestedByName: user.name || user.email,
    requestedByEmail: user.email,
    requestedBy: user._id,
    notes: notes || "",
  })

  const when = new Date(appointment.start).toLocaleString("no-NO", { dateStyle: "medium", timeStyle: "short" })
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

  return NextResponse.json({ appointment }, { status: 201 })
})
