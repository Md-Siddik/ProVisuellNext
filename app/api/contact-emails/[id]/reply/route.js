import mongoose from "mongoose"
import { NextResponse } from "next/server"
import { ApiError, authenticate, requireRole, withApiErrors } from "@/lib/auth"
import { ContactEmail } from "@/lib/models/ContactEmail"
import { getBusinessEmail, sendEmail } from "@/lib/mailer"

// Staff answer a website email straight from the dashboard: the reply is
// mailed to the original sender (replies to it land back in the business
// inbox) and kept on the record so the thread shows what was answered.
export const POST = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const { user } = await authenticate(request)
  requireRole(user, ["administrator", "owner"])
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Not found")

  const body = (await request.json().catch(() => ({}))) || {}
  const text = typeof body.text === "string" ? body.text.trim() : ""
  if (!text) throw new ApiError(400, "text is required")

  const email = await ContactEmail.findById(id)
  if (!email) throw new ApiError(404, "Not found")

  const ok = await sendEmail({
    to: email.email,
    subject: "Svar fra ProVisuell",
    text: `${text}\n\n---\nDin opprinnelige melding:\n${email.message}`,
    replyTo: getBusinessEmail() || undefined,
  })
  if (!ok) throw new ApiError(502, "Could not send email right now.")

  email.replies.push({ text, sentBy: user.name || user.email || "" })
  email.read = true
  await email.save()
  return NextResponse.json({ email })
})
