import nodemailer from "nodemailer"

// Single Nodemailer transporter + single source of truth for the env vars
// every route needs — orders.js, appointments.js, messages.js, invoices.js
// and routes/email.js all go through this instead of each constructing
// their own SMTP connection.
//
// Required server-side env vars (Server/.env):
//   SMTP_HOST     e.g. mail.provisuell.no
//   SMTP_PORT     465
//   SMTP_USER     e.g. info@provisuell.no
//   SMTP_PASS
//   FROM_EMAIL    e.g. info@provisuell.no (defaults the "from" address)
//   BUSINESS_EMAIL e.g. info@provisuell.no (where business alerts go)

let transporter = null

export function isEmailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

export function getBusinessEmail() {
  return process.env.BUSINESS_EMAIL || ""
}

function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 465
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      // Port 465 is implicit TLS (the connection is encrypted from the
      // start) — this is NOT the STARTTLS negotiation port 587 uses, so
      // `secure` must stay true here rather than toggling off it.
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }
  return transporter
}

// The address must stay the authenticated mailbox (the SMTP server rejects
// or spam-flags any other sender), but the display name can be anyone — used
// for the contact form so the inbox shows who wrote in. Passed as an object
// so nodemailer encodes/quotes the name itself (no header injection).
function defaultFrom(fromName) {
  const address = process.env.FROM_EMAIL || process.env.SMTP_USER
  const name = String(fromName || "").replace(/[\r\n]+/g, " ").trim()
  return { name: name || "ProVisuell", address }
}

// Best-effort — never throws. Every call site treats delivery as
// fire-and-forget: a missing/invalid SMTP config must never block the
// order/booking/message it's reporting on. Returns true/false so a caller
// that needs to tell the user delivery failed (the public contact form) can.
export async function sendEmail({ to, subject, text, html, replyTo, from, fromName }) {
  if (!isEmailConfigured() || !to) return false
  try {
    await getTransporter().sendMail({
      from: from || defaultFrom(fromName),
      to,
      subject,
      text,
      ...(html ? { html } : {}),
      ...(replyTo ? { replyTo } : {}),
    })
    return true
  } catch (err) {
    // .message only — never the error object itself, which some SMTP
    // libraries populate with the raw server response/command that could
    // echo back connection details.
    console.error("Email send failed:", err.message)
    return false
  }
}

// Notifies the business inbox (BUSINESS_EMAIL) — used for new order /
// booking / chat-message alerts. Silently does nothing if unconfigured.
export async function notifyBusiness({ subject, text, html, replyTo, fromName }) {
  const to = getBusinessEmail()
  if (!to) return false
  return sendEmail({ to, subject, text, html, replyTo, fromName })
}

// Verifies the backend can actually authenticate against the SMTP server —
// used by the one-off connection check, not by any request path.
export async function verifySmtpConnection() {
  if (!isEmailConfigured()) return false
  try {
    await getTransporter().verify()
    return true
  } catch (err) {
    console.error("SMTP connection check failed:", err.message)
    return false
  }
}
