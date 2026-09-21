import { NextResponse } from "next/server"
import { authenticate, requireRole, withApiErrors } from "@/lib/auth"
import { Conversation } from "@/lib/models/Conversation"

// This returns the TOTAL NUMBER OF UNREAD MESSAGES across every customer.
export const GET = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  requireRole(user, ["administrator", "owner"])
  try {
    const result = await Conversation.aggregate([
      { $group: { _id: null, count: { $sum: { $ifNull: ["$unreadAdminCount", 0] } } } },
    ])
    const count = Number(result[0]?.count || 0)
    return NextResponse.json({ count })
  } catch (error) {
    console.error("GET /messages/unread-count failed:", error)
    return NextResponse.json({ error: "Failed to load unread count" }, { status: 500 })
  }
})
