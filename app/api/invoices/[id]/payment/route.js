import { NextResponse } from "next/server"
import { authenticate, withApiErrors, ApiError } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { Invoice } from "@/lib/models/Invoice"
import { computeInvoiceStatus, invoiceAmounts, withInvoiceStatus } from "@/lib/invoices/status"

// Record payments on an invoice. The payment status is never taken from the
// request — it's derived from the amounts (lib/invoices/status.js):
//   { amountPaid }      set the total paid so far
//   { addPayment }      add one payment to what's already paid
//   { status: "paid" }  mark fully paid (amountPaid = total)
//   { status: "cancelled" } / { status: "unpaid" } cancel / reopen
export const PATCH = withApiErrors(async (request, { params }) => {
  const { id } = await params
  requirePermission(await authenticate(request), "invoices.recordPayment")

  const body = (await request.json().catch(() => ({}))) || {}
  const invoice = await Invoice.findById(id)
  if (!invoice) throw new ApiError(404, "Invoice not found")
  const { total } = invoiceAmounts(invoice)
  const wasPaid = computeInvoiceStatus(invoice) === "paid"

  if (body.status !== undefined && !["paid", "unpaid", "cancelled"].includes(body.status)) {
    throw new ApiError(400, "Invalid status")
  }
  if (body.status === "cancelled") {
    invoice.status = "cancelled"
  } else {
    if (body.status === "unpaid" && invoice.status === "cancelled") invoice.status = "unpaid"
    if (body.status === "paid") invoice.amountPaid = total
    if (body.amountPaid !== undefined) invoice.amountPaid = Math.max(0, Number(body.amountPaid) || 0)
    if (body.addPayment !== undefined) {
      const add = Number(body.addPayment)
      if (!Number.isFinite(add) || add <= 0) throw new ApiError(400, "Invalid payment amount")
      invoice.amountPaid = Math.max(0, Number(invoice.amountPaid) || 0) + add
    }
    if (invoice.amountPaid > total) invoice.amountPaid = total
    invoice.status = computeInvoiceStatus({ ...invoice.toObject(), status: "unpaid" })
  }
  // When the money actually arrived, so reports recognize revenue on the real payment date.
  if (invoice.status === "paid" && !wasPaid) invoice.paidAt = new Date()
  if (invoice.status !== "paid") invoice.paidAt = null
  await invoice.save()
  return NextResponse.json({ invoice: withInvoiceStatus(invoice) })
})
