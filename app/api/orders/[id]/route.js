import { NextResponse } from "next/server"
import { authenticate, withApiErrors, ApiError } from "@/lib/auth"
import { Order } from "@/lib/models/Order"
import { Invoice } from "@/lib/models/Invoice"

export const GET = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const { user } = await authenticate(request)
  const order = await Order.findById(id)
  if (!order) throw new ApiError(404, "Order not found")
  if (user.role === "customer" && String(order.customerId) !== String(user._id)) {
    throw new ApiError(403, "Not your order")
  }
  const inv = await Invoice.findOne({ orderId: order._id }).select("invoiceNumber status")
  return NextResponse.json({
    order: {
      ...order.toObject(),
      invoice: inv ? { _id: inv._id, invoiceNumber: inv.invoiceNumber, status: inv.status } : null,
    },
  })
})
