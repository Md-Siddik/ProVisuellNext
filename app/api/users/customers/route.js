import { NextResponse } from "next/server"
import { authenticate, requireRole, withApiErrors } from "@/lib/auth"
import { User } from "@/lib/models/User"

// Lets admins/owners find a customer's real account when registering an
// order, so the order links to the exact email they signed up with instead
// of a hand-typed guess.
export const GET = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  requireRole(user, ["administrator", "owner"])

  const search = (new URL(request.url).searchParams.get("search") || "").trim()
  const query = { role: "customer" }
  if (search) {
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    query.$or = [{ name: new RegExp(safe, "i") }, { email: new RegExp(safe, "i") }]
  }
  const customers = await User.find(query).select("name email").sort({ name: 1 }).limit(8)
  return NextResponse.json({ customers })
})
