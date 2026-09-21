import { NextResponse } from "next/server"
import { authenticate, requireRole, withApiErrors } from "@/lib/auth"
import { Conversation } from "@/lib/models/Conversation"

export const GET = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  requireRole(user, ["administrator", "owner"])
  try {
    const conversations = await Conversation.find().sort({ lastMessageAt: -1 }).lean()
    return NextResponse.json({ conversations })
  } catch (error) {
    console.error("GET /messages failed:", error)
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 })
  }
})
