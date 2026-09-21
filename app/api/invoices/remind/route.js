import { NextResponse } from "next/server"
import { authenticate, requireRole, withApiErrors, ApiError } from "@/lib/auth"
import { Invoice } from "@/lib/models/Invoice"
import { notifyUser } from "@/lib/notify"
import { createStatementInvoice } from "@/lib/invoicing"
import { sendEmail } from "@/lib/mailer"

// Rolls every due invoice for a customer into one real statement invoice
// (see createStatementInvoice) and sends that — not just a text summary —
// alongside the in-app notification. Entirely separate from the per-order
// "Fakturer"/"Vis faktura" buttons and the [id]/send route, which are
// unchanged.
export const POST = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  requireRole(user, ["administrator", "owner"])

  const { invoiceIds, customerId, customerEmail, customerName } = (await request.json().catch(() => ({}))) || {}
  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    throw new ApiError(400, "invoiceIds is required")
  }

  const invoices = await Invoice.find({ _id: { $in: invoiceIds } })
  if (invoices.length === 0) throw new ApiError(404, "No matching invoices found")

  const dueInvoices = invoices.map((inv) => ({
    _id: inv._id,
    invoiceNumber: inv.invoiceNumber,
    orderNumber: inv.orderNumber,
    amount: Math.max(0, inv.grandTotal - (inv.amountPaid || 0)),
  }))
  const totalDue = dueInvoices.reduce((sum, inv) => sum + inv.amount, 0)
  const plural = invoices.length > 1

  const statement = await createStatementInvoice({
    customerId,
    customerEmail,
    customerName,
    dueInvoices,
    createdBy: user._id,
  })

  if (customerEmail) {
    const lines = invoices
      .map((inv) => `- ${inv.invoiceNumber}: kr ${inv.grandTotal.toFixed(2)} (forfaller ${inv.dueDate.toLocaleDateString("no-NO")})`)
      .join("\n")
    await sendEmail({
      to: customerEmail,
      subject: `Påminnelse: ${invoices.length} ubetalt${plural ? "e" : ""} faktura${plural ? "er" : ""} fra ProVisuell`,
      text: `Hei ${customerName || ""},\n\nDu har ${invoices.length} ubetalt${plural ? "e" : ""} faktura${plural ? "er" : ""} hos ProVisuell, til sammen kr ${totalDue.toFixed(2)}:\n\n${lines}\n\nVi har samlet dette i én faktura (${statement.invoiceNumber}) som du finner her: ${process.env.CLIENT_URL || ""}/faktura/${statement._id}\n\nVennligst betal snarest mulig.\n\nMvh ProVisuell`,
    })
  }

  if (customerId) {
    notifyUser(customerId, {
      type: "invoice_reminder",
      title: `Påminnelse om ${invoices.length} ubetalt${plural ? "e" : ""} faktura${plural ? "er" : ""}`,
      message: `Samlefaktura ${statement.invoiceNumber} — kr ${totalDue.toFixed(2)} utestående`,
      link: `/faktura/${statement._id}`,
    })
  }

  return NextResponse.json({ sent: true, count: invoices.length, totalDue, statement })
})
