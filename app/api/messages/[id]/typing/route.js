import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { Conversation } from "@/lib/models/Conversation"

export const POST = withApiErrors(async (request, { params }) => {
  const { id } = await params
  requirePermission(await authenticate(request), "messages.reply")
  try {
    const result = await Conversation.updateOne({ _id: id }, { $set: { "typing.admin": new Date() } })
    if (!result.matchedCount) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error("POST /messages/:id/typing failed:", error)
    return NextResponse.json({ error: "Failed to update typing status" }, { status: 500 })
  }
})
