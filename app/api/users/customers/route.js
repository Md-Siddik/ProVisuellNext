import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"
import { can, requirePermission } from "@/lib/access"
import { User } from "@/lib/models/User"

// Lets admins/owners find a customer's real account when registering an
// order, so the order links to the exact email they signed up with instead
// of a hand-typed guess.
export const GET = withApiErrors(async (request) => {
  const auth = requirePermission(await authenticate(request), "customers.viewBasic")

  const search = (new URL(request.url).searchParams.get("search") || "").trim()
  const query = { role: "customer" }
  if (search) {
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    // Searching by email is only possible for viewers allowed to see emails.
    query.$or = can(auth, "customers.viewEmail") ? [{ name: new RegExp(safe, "i") }, { email: new RegExp(safe, "i") }] : [{ name: new RegExp(safe, "i") }]
  }
  const customers = await User.find(query)
    .select(can(auth, "customers.viewEmail") ? "name email" : "name")
    .sort({ name: 1 })
    .limit(8)
  return NextResponse.json({ customers })
})
