import { NextResponse } from "next/server"
import { authenticate, withApiErrors, ApiError } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { Invoice } from "@/lib/models/Invoice"
import { notifyUser } from "@/lib/notify"
import { sendEmail } from "@/lib/mailer"
import { renderInvoiceEmail } from "@/lib/invoices/email"
import { withInvoiceStatus } from "@/lib/invoices/status"
import { User } from "@/lib/models/User"
import { pickLanguage } from "@/lib/i18n/server"

// Best-effort email, same graceful-degrade pattern as order-decision and
// contact-form email elsewhere — works without config, sends for real once
// SMTP_HOST/SMTP_USER/SMTP_PASS are set (see lib/mailer.js).
export const POST = withApiErrors(async (request, { params }) => {
  const { id } = await params
  requirePermission(await authenticate(request), "invoices.send")

  const invoice = await Invoice.findById(id)
  if (!invoice) throw new ApiError(404, "Invoice not found")

  // The full invoice (same data and status rule as the invoice page / PDF),
  // from the configured ProVisuell SMTP sender.
  // Language: the customer's saved one, else the sender's active language.
  const { lang } = (await request.json().catch(() => ({}))) || {}
  const customer = invoice.customerId ? await User.findById(invoice.customerId).select("language").lean() : null
  const language = pickLanguage(customer?.language, lang)
  let delivered = false
  if (invoice.customer?.email) {
    const base = (process.env.CLIENT_URL || new URL(request.url).origin).replace(/\/$/, "")
    const email = renderInvoiceEmail(invoice, { viewUrl: `${base}/faktura/${invoice._id}`, lang: language })
    delivered = await sendEmail({ to: invoice.customer.email, subject: email.subject, html: email.html, text: email.text })
  }
  invoice.sentAt = new Date()
  await invoice.save()

  if (invoice.customerId) {
    notifyUser(invoice.customerId, {
      type: "invoice_sent",
      title: "Ny faktura fra ProVisuell",
      message: `${invoice.invoiceNumber} — forfaller ${invoice.dueDate.toLocaleDateString("no-NO")}`,
      link: `/faktura/${invoice._id}`,
    })
  }

  return NextResponse.json({ invoice: withInvoiceStatus(invoice), delivered })
})
