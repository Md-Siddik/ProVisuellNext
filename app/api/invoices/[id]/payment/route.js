import { NextResponse } from "next/server"
import { authenticate, requireRole, withApiErrors, ApiError } from "@/lib/auth"
import { Invoice } from "@/lib/models/Invoice"

// Payment status — the one piece of an issued invoice that's expected to
// change over its life.
export const PATCH = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const { user } = await authenticate(request)
  requireRole(user, ["administrator", "owner"])

  const { status, amountPaid } = (await request.json().catch(() => ({}))) || {}
  const allowed = ["unpaid", "partially_paid", "paid", "overdue", "cancelled"]
  const update = {}
  if (status !== undefined) {
    if (!allowed.includes(status)) throw new ApiError(400, "Invalid status")
    update.status = status
    // Records when the money actually arrived, so reports can recognize
    // revenue by real payment date instead of invoice date.
    update.paidAt = status === "paid" ? new Date() : null
  }
  if (amountPaid !== undefined) update.amountPaid = Math.max(0, Number(amountPaid) || 0)

  const invoice = await Invoice.findByIdAndUpdate(id, update, { new: true })
  if (!invoice) throw new ApiError(404, "Invoice not found")
  return NextResponse.json({ invoice })
})
