import { authenticate, withApiErrors } from "@/lib/auth"
import { Order } from "@/lib/models/Order"

// Called when the customer opens "Mine bestillinger" — clears the badge.
export const POST = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  await Order.updateMany(
    { customerId: user._id, status: { $in: ["approved", "rejected", "completed"] }, customerSeenAt: null },
    { customerSeenAt: new Date() }
  )
  return new Response(null, { status: 204 })
})
