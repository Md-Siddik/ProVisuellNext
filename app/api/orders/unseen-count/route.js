import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"
import { Order } from "@/lib/models/Order"

// How many of the customer's own orders were decided but they haven't
// looked at yet — drives the "Min side" notification badge.
export const GET = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  if (user.role !== "customer") return NextResponse.json({ count: 0 })
  const count = await Order.countDocuments({
    customerId: user._id,
    status: { $in: ["approved", "rejected", "completed"] },
    customerSeenAt: null,
  })
  return NextResponse.json({ count })
})
