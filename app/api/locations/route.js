import { NextResponse } from "next/server"
import { authenticate, requireRole, withApiErrors } from "@/lib/auth"
import { CustomerLocation } from "@/lib/models/CustomerLocation"

// Staff-only: every saved location, joined with its order, for the
// "Kundelokasjoner" list. A public/unauthenticated caller — or a plain
// customer — never reaches this: requireRole below 403s them before any
// coordinates are read.
export const GET = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  requireRole(user, ["administrator", "owner"])

  const locations = await CustomerLocation.find({})
    .sort({ updatedAt: -1 })
    .populate({ path: "order", select: "orderNumber service status expectedDeliveryDate" })

  return NextResponse.json({ locations: locations.filter((loc) => loc.order) })
})
