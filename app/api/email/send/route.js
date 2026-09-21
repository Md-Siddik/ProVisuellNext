import { NextResponse } from "next/server"
import { withApiErrors, ApiError } from "@/lib/auth"
import { getBusinessEmail, isEmailConfigured, notifyBusiness } from "@/lib/mailer"
import { connectDB } from "@/lib/db"
import { ContactEmail } from "@/lib/models/ContactEmail"
import { notifyRole } from "@/lib/notify"

// No auth required — this is the public "send us an email" composer on the
// marketing site, open to anyone (customers don't have to log in just to
// send a message this way).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const POST = withApiErrors(async (request) => {
  const { name, email, message } = (await request.json().catch(() => ({}))) || {}
  if (!name || !email || !message) {
    throw new ApiError(400, "name, email and message are required")
  }
  if (!EMAIL_RE.test(String(email).trim())) {
    throw new ApiError(400, "A valid email address is required")
  }

  if (!isEmailConfigured() || !getBusinessEmail()) {
    throw new ApiError(503, "Email sending isn't configured yet (SMTP_HOST / SMTP_USER / SMTP_PASS / BUSINESS_EMAIL missing).")
  }

  const ok = await notifyBusiness({
    subject: `Ny henvendelse fra ${name} via nettsiden`,
    text: `Fra: ${name} <${email}>\n\n${message}`,
    replyTo: email,
    fromName: String(name).trim(),
  })
  if (!ok) throw new ApiError(502, "Could not send email right now.")

  // The mail is already out — keeping a copy for the dashboard and alerting
  // staff is best-effort and must never turn a delivered message into an error.
  try {
    await connectDB()
    await ContactEmail.create({ name: String(name).trim(), email: String(email).trim(), message: String(message) })
    const alert = { type: "contact_email", title: "Ny e-post fra nettsiden", message: `${String(name).trim()}: ${String(message).slice(0, 80)}` }
    await notifyRole("owner", { ...alert, link: "/dashboard/owner/meldinger?tab=emails" })
    await notifyRole("administrator", { ...alert, link: "/dashboard/admin/meldinger?tab=emails" })
  } catch (err) {
    console.error("Failed to store/notify contact email:", err.message)
  }
  return NextResponse.json({ ok: true })
})
