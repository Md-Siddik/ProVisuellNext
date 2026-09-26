import { NextResponse } from "next/server"
import { authenticate, withApiErrors, ApiError } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { Order } from "@/lib/models/Order"
import { Appointment } from "@/lib/models/Appointment"
import { Invoice } from "@/lib/models/Invoice"
import { notifyUser } from "@/lib/notify"
import { createInvoiceFromOrder } from "@/lib/invoicing"
import { notifyCustomerOfDecision } from "@/lib/orderHelpers"

export const PATCH = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const auth = await authenticate(request)
  const { user } = auth

  const { status } = (await request.json().catch(() => ({}))) || {}
  if (!["approved", "rejected", "completed"].includes(status)) {
    throw new ApiError(400, "status must be 'approved', 'rejected' or 'completed'")
  }
  // Each decision is its own permission (orders.approve / .reject / .complete).
  requirePermission(auth, { approved: "orders.approve", rejected: "orders.reject", completed: "orders.complete" }[status])

  // "completed" is a follow-up milestone on an already-approved order, not
  // a new decision — decidedAt/decidedBy must stay pinned to the original
  // approval, otherwise the revenue would silently move to whatever month
  // the order happens to get marked complete in.
  const update =
    status === "completed"
      ? { status, completedAt: new Date(), customerSeenAt: null }
      : { status, decidedBy: user._id, decidedAt: new Date(), customerSeenAt: null }

  const order = await Order.findByIdAndUpdate(id, update, { new: true })
  if (!order) throw new ApiError(404, "Order not found")

  // The meeting this order came from has now served its purpose either way
  // — mark it completed so it drops off the customer's "Mine avtaler" and
  // its join link disappears.
  if (order.appointmentId) {
    await Appointment.findByIdAndUpdate(order.appointmentId, { status: "completed" })
  }

  // Completing an order used to require a separate "Opprett faktura" form
  // before the invoice existed at all — issue it automatically instead
  // (default terms: due in 14 days, no discount) so the order list shows
  // the real invoice the moment it's completed, no extra step. Best-effort:
  // an invoicing hiccup must never block the order from completing, and the
  // "Opprett faktura" button still covers manual creation as a fallback.
  let invoiceSummary = null
  if (order.status === "completed") {
    try {
      const existingInvoice = await Invoice.findOne({ orderId: order._id })
      const invoice = existingInvoice || (await createInvoiceFromOrder(order, { createdBy: user._id }))
      invoiceSummary = { _id: invoice._id, invoiceNumber: invoice.invoiceNumber, status: invoice.status }
    } catch (err) {
      console.error("Auto-invoice creation failed for order", order._id.toString(), ":", err.message)
    }
  }

  notifyCustomerOfDecision(order)

  if (order.customerId) {
    const titleByStatus = {
      approved: "Bestillingen din er godkjent",
      rejected: "Bestillingen din ble avvist",
      completed: "Bestillingen din er fullført",
    }
    notifyUser(order.customerId, {
      type: "order_decided",
      title: titleByStatus[order.status],
      message: `#${order.orderNumber} — ${order.service}`,
      link: `/mine-bestillinger/${order._id}`,
    })
  }

  return NextResponse.json({ order: { ...order.toObject(), invoice: invoiceSummary } })
})
