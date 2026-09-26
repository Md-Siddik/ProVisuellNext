import { NextResponse } from "next/server"
import { authenticate, withApiErrors, ApiError } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { Invoice } from "@/lib/models/Invoice"
import { notifyUser } from "@/lib/notify"
import { createStatementInvoice } from "@/lib/invoicing"
import { sendEmail } from "@/lib/mailer"
import { renderInvoiceEmail } from "@/lib/invoices/email"
import { User } from "@/lib/models/User"
import { DATE_LOCALES, pickLanguage, translator } from "@/lib/i18n/server"

// Rolls every due invoice for a customer into one real statement invoice
// (see createStatementInvoice) and sends that — not just a text summary —
// alongside the in-app notification. Entirely separate from the per-order
// "Fakturer"/"Vis faktura" buttons and the [id]/send route, which are
// unchanged.
export const POST = withApiErrors(async (request) => {
  const { user } = requirePermission(await authenticate(request), "invoices.send")

  const { invoiceIds, customerId, customerEmail, customerName, lang } = (await request.json().catch(() => ({}))) || {}
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
    // The statement goes out as a full invoice too, with the list of what it
    // covers — in the customer's saved language (else the sender's).
    const customer = customerId ? await User.findById(customerId).select("language").lean().catch(() => null) : null
    const language = pickLanguage(customer?.language, lang)
    const t = translator(language)
    const kr = (n) => `kr ${Number(n).toFixed(2)}`
    const list = invoices
      .map((inv) =>
        t("invoiceEmail.remindLine", {
          number: inv.invoiceNumber,
          amount: kr(Math.max(0, inv.grandTotal - (inv.amountPaid || 0))),
          date: inv.dueDate.toLocaleDateString(DATE_LOCALES[language], { timeZone: "Europe/Oslo" }),
        })
      )
      .map((l) => l.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]))
      .join("<br>")
    const base = (process.env.CLIENT_URL || new URL(request.url).origin).replace(/\/$/, "")
    const email = renderInvoiceEmail(statement, {
      viewUrl: `${base}/faktura/${statement._id}`,
      lang: language,
      intro: `${t(plural ? "invoiceEmail.remindIntroMany" : "invoiceEmail.remindIntroOne", { n: invoices.length, amount: kr(totalDue), number: statement.invoiceNumber })}<br><br>${list}`,
    })
    await sendEmail({
      to: customerEmail,
      subject: t(plural ? "invoiceEmail.remindSubjectMany" : "invoiceEmail.remindSubjectOne", { n: invoices.length }),
      html: email.html,
      text: email.text,
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
