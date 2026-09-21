import { NextResponse } from "next/server"
import { authenticate, withApiErrors, ApiError } from "@/lib/auth"
import { CustomerLocation } from "@/lib/models/CustomerLocation"

// Customer: which of their own orders already have a saved location — used
// by "Mine bestillinger" to show a "location not shared yet" reminder only
// where it's actually missing. Scoped strictly to user._id, so this never
// reveals anything about another customer's orders.
export const GET = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  if (user.role !== "customer") throw new ApiError(403, "Only a customer can list their own locations")
  const locations = await CustomerLocation.find({ customer: user._id }).select("order")
  return NextResponse.json({ orderIds: locations.map((l) => String(l.order)) })
})
