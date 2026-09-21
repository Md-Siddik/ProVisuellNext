import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"
import { Conversation } from "@/lib/models/Conversation"
import { getOrCreateOwnConversation } from "@/lib/messageHelpers"

export const POST = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  try {
    const convo = await getOrCreateOwnConversation(user)
    await Conversation.updateOne({ _id: convo._id }, { $set: { "typing.user": new Date() } })
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error("POST /messages/mine/typing failed:", error)
    return NextResponse.json({ error: "Failed to update typing status" }, { status: 500 })
  }
})
