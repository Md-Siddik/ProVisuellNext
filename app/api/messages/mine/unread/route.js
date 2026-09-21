import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"
import { Conversation } from "@/lib/models/Conversation"

// Used by the floating chat icon.
export const GET = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  try {
    const convo = await Conversation.findOne({ customer: user._id }).select("unreadForCustomer unreadCustomerCount")
    const count = Number(convo?.unreadCustomerCount || 0)
    return NextResponse.json({ unread: count > 0, count })
  } catch (error) {
    console.error("GET /messages/mine/unread failed:", error)
    return NextResponse.json({ error: "Failed to load unread count" }, { status: 500 })
  }
})
