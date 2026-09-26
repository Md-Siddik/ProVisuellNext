import { NextResponse } from "next/server"
import { authenticate, withApiErrors, ApiError } from "@/lib/auth"
import { CUSTOMER_CONTACT_FIELDS, can, redact } from "@/lib/access"
import { Order } from "@/lib/models/Order"
import { Invoice } from "@/lib/models/Invoice"
import { computeInvoiceStatus } from "@/lib/invoices/status"

export const GET = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const auth = await authenticate(request)
  const { user } = auth
  const order = await Order.findById(id)
  if (!order) throw new ApiError(404, "Order not found")
  const own = String(order.customerId) === String(user._id)
  if (!own && !can(auth, "orders.view")) {
    throw new ApiError(403, "Not your order")
  }
  const inv = await Invoice.findOne({ orderId: order._id }).select("invoiceNumber status grandTotal amountPaid dueDate")
  return NextResponse.json({
    order: {
      ...(own ? order.toObject() : redact(auth, order, CUSTOMER_CONTACT_FIELDS)),
      invoice: inv ? { _id: inv._id, invoiceNumber: inv.invoiceNumber, status: computeInvoiceStatus(inv) } : null,
    },
  })
})
