import { NextResponse } from "next/server"
import { authenticate, requireRole, withApiErrors, ApiError } from "@/lib/auth"
import { Invoice } from "@/lib/models/Invoice"
import { notifyUser } from "@/lib/notify"
import { sendEmail } from "@/lib/mailer"

// Best-effort email, same graceful-degrade pattern as order-decision and
// contact-form email elsewhere — works without config, sends for real once
// SMTP_HOST/SMTP_USER/SMTP_PASS are set (see lib/mailer.js).
export const POST = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const { user } = await authenticate(request)
  requireRole(user, ["administrator", "owner"])

  const invoice = await Invoice.findById(id)
  if (!invoice) throw new ApiError(404, "Invoice not found")

  if (invoice.customer?.email) {
    await sendEmail({
      to: invoice.customer.email,
      subject: `Faktura ${invoice.invoiceNumber} fra ProVisuell`,
      text: `Hei ${invoice.customer.name},\n\nVedlagt finner du faktura ${invoice.invoiceNumber} pålydende kr ${invoice.grandTotal.toFixed(2)}, forfallsdato ${invoice.dueDate.toLocaleDateString("no-NO")}.\n\nMvh ProVisuell`,
    })
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

  return NextResponse.json({ invoice })
})
