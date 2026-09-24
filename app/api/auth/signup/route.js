import { NextResponse } from "next/server"
import { ApiError, withApiErrors } from "@/lib/auth"
import { connectDB } from "@/lib/db"
import { isEmailConfigured, sendEmail } from "@/lib/mailer"
import { User } from "@/lib/models/User"
import { PendingSignup } from "@/lib/models/PendingSignup"
import { buildToken, encryptPassword } from "@/lib/pendingSignup"

// Public email/password signup, step 1 of 2. Nothing is created in Firebase
// here — the details are parked in PendingSignup and a verification link is
// emailed. Step 2 (./verify) creates the Firebase account once that link is
// opened, so an address nobody has confirmed never reaches Firebase.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RESEND_COOLDOWN_MS = 60 * 1000

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

const COPY = {
  no: {
    subject: "Bekreft e-postadressen din – ProVisuell",
    greeting: (name) => (name ? `Hei ${name},` : "Hei,"),
    body: "Takk for at du registrerte deg hos ProVisuell. Klikk på knappen under for å bekrefte e-postadressen din og aktivere kontoen.",
    button: "Bekreft e-postadresse",
    fallback: "Fungerer ikke knappen? Kopier denne lenken inn i nettleseren:",
    expiry: "Lenken er gyldig i 24 timer. Har du ikke registrert deg, kan du se bort fra denne e-posten.",
  },
  en: {
    subject: "Confirm your email address – ProVisuell",
    greeting: (name) => (name ? `Hi ${name},` : "Hi,"),
    body: "Thanks for signing up with ProVisuell. Click the button below to confirm your email address and activate your account.",
    button: "Confirm email address",
    fallback: "Button not working? Copy this link into your browser:",
    expiry: "The link is valid for 24 hours. If you didn't sign up, you can ignore this email.",
  },
}

function verificationEmail({ name, link, lang }) {
  // Swedish and Danish readers get the Norwegian text; Finnish readers English.
  const c = COPY[["en", "fi"].includes(lang) ? "en" : "no"]
  const text = `${c.greeting(name)}\n\n${c.body}\n\n${link}\n\n${c.expiry}`
  const html = `<!doctype html>
<html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden">
        <tr><td style="background:#0a0a0a;padding:22px 28px;color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.02em">Pro<span style="color:#ff4b00">Visuell</span></td></tr>
        <tr><td style="padding:28px">
          <p style="margin:0 0 14px;font-size:16px;font-weight:700">${escapeHtml(c.greeting(name))}</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#3f3f46">${c.body}</p>
          <a href="${escapeHtml(link)}" style="display:inline-block;background:#ff4b00;color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:13px 22px;border-radius:10px">${c.button}</a>
          <p style="margin:26px 0 6px;font-size:12.5px;color:#71717a">${c.fallback}</p>
          <p style="margin:0 0 20px;font-size:12.5px;word-break:break-all"><a href="${escapeHtml(link)}" style="color:#ff4b00">${escapeHtml(link)}</a></p>
          <p style="margin:0;font-size:12.5px;line-height:1.6;color:#71717a">${c.expiry}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
  return { subject: c.subject, text, html }
}

export const POST = withApiErrors(async (request) => {
  const body = (await request.json().catch(() => ({}))) || {}
  const name = String(body.name || "").trim().slice(0, 120)
  const email = String(body.email || "").trim().toLowerCase()
  const password = typeof body.password === "string" ? body.password : ""
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : ""
  const lang = String(body.lang || "")

  if (!EMAIL_RE.test(email) || email.length > 254) throw new ApiError(400, "A valid email address is required")
  if (password.length < 6) throw new ApiError(400, "Password must be at least 6 characters")
  if (password.length > 128) throw new ApiError(400, "Password is too long")
  // The form checks this too, but the link must never go out on a mismatch.
  if (password !== confirmPassword) throw new ApiError(400, "Passwords do not match")

  if (!isEmailConfigured()) {
    throw new ApiError(503, "Email sending isn't configured yet (SMTP_HOST / SMTP_USER / SMTP_PASS missing).")
  }

  await connectDB()
  if (await User.exists({ email: new RegExp(`^${escapeRegex(email)}$`, "i") })) {
    throw new ApiError(409, "An account with this email already exists")
  }

  const existing = await PendingSignup.findOne({ email })
  if (existing && Date.now() - existing.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new ApiError(429, "Please wait a minute before requesting another email")
  }

  // A new request replaces any earlier one, so only the newest link works.
  const { key, iv, tag, ciphertext } = encryptPassword(password)
  const pending = await PendingSignup.findOneAndUpdate(
    { email },
    { $set: { name, iv, tag, ciphertext, createdAt: new Date() } },
    { upsert: true, new: true }
  )

  // CLIENT_URL first: building the link from the request's Host header would
  // let a forged header send the link (and its key) to someone else's domain.
  const origin = (process.env.CLIENT_URL || new URL(request.url).origin).replace(/\/$/, "")
  const link = `${origin}/verify-email?token=${encodeURIComponent(buildToken(pending._id.toString(), key))}`

  const sent = await sendEmail({ to: email, ...verificationEmail({ name, link, lang }) })
  if (!sent) {
    await PendingSignup.deleteOne({ _id: pending._id })
    throw new ApiError(502, "Could not send email right now.")
  }

  return NextResponse.json({ ok: true, email })
})
