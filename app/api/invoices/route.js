import { NextResponse } from "next/server"
import { authenticate, withApiErrors, ApiError } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { Invoice } from "@/lib/models/Invoice"
import { Order } from "@/lib/models/Order"
import { createInvoiceFromOrder } from "@/lib/invoicing"

// Issues an invoice from an order — snapshots the customer + items +
// totals as they are right now. Any later edit to the order will never
// touch this document again.
// Manual fallback for the rare case auto-creation (see orders [id]/status
// route) didn't happen — e.g. an order completed before this existed.
// dueDate is optional now; omitted, it defaults to +14 days.
export const POST = withApiErrors(async (request) => {
  const { user } = requirePermission(await authenticate(request), "invoices.create")

  const { orderId, dueDate, deliveryDate, deliveryPlace, discount, paymentTerms, note, payment } =
    (await request.json().catch(() => ({}))) || {}
  if (!orderId) {
    throw new ApiError(400, "orderId is required")
  }

  const order = await Order.findById(orderId)
  if (!order) throw new ApiError(404, "Order not found")
  if (order.status !== "completed") {
    throw new ApiError(400, "Only completed orders can be invoiced")
  }

  const existing = await Invoice.findOne({ orderId })
  if (existing) {
    return NextResponse.json({ error: "This order already has an invoice", invoice: existing }, { status: 409 })
  }

  const invoice = await createInvoiceFromOrder(order, {
    dueDate,
    deliveryDate,
    deliveryPlace,
    discount,
    paymentTerms,
    note,
    payment,
    createdBy: user._id,
  })

  return NextResponse.json({ invoice }, { status: 201 })
})
