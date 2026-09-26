import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"
import { CUSTOMER_CONTACT_FIELDS, redact, requirePermission } from "@/lib/access"
import { Conversation } from "@/lib/models/Conversation"

export const GET = withApiErrors(async (request) => {
  const auth = requirePermission(await authenticate(request), "messages.view")
  try {
    // The list needs names, time and unread counts — not every message of
    // every conversation (the open thread loads via /messages/:id).
    const conversations = await Conversation.find()
      .select("customer customerName customerEmail lastMessageAt unreadForAdmin unreadAdminCount unreadForCustomer unreadCustomerCount updatedAt createdAt")
      .sort({ lastMessageAt: -1 })
      .lean()
    // Contact details are stripped server-side for viewers without the
    // matching customers.* permission (e.g. moderators).
    return NextResponse.json({ conversations: conversations.map((c) => redact(auth, c, CUSTOMER_CONTACT_FIELDS)) })
  } catch (error) {
    console.error("GET /messages failed:", error)
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 })
  }
})
