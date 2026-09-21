import { NextResponse } from "next/server"
import { authenticate, requireRole, withApiErrors } from "@/lib/auth"
import { Conversation } from "@/lib/models/Conversation"
import { notifyUser } from "@/lib/notify"

// Opening one conversation clears unread messages only for that thread.
export const GET = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const { user } = await authenticate(request)
  requireRole(user, ["administrator", "owner"])
  try {
    const convo = await Conversation.findById(id)
    if (!convo) return NextResponse.json({ error: "Conversation not found" }, { status: 404 })

    convo.unreadForAdmin = false
    convo.unreadAdminCount = 0
    await convo.save()

    return NextResponse.json({ conversation: convo })
  } catch (error) {
    console.error("GET /messages/:id failed:", error)
    return NextResponse.json({ error: "Failed to load conversation" }, { status: 500 })
  }
})

// Exact message text is preserved here too.
export const POST = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const { user } = await authenticate(request)
  requireRole(user, ["administrator", "owner"])
  try {
    const body = (await request.json().catch(() => ({}))) || {}
    const rawText = typeof body.text === "string" ? body.text : ""
    const messageText = rawText.trim()

    if (!messageText) {
      return NextResponse.json({ error: "text is required" }, { status: 400 })
    }

    const convo = await Conversation.findById(id)
    if (!convo) return NextResponse.json({ error: "Conversation not found" }, { status: 404 })

    convo.messages.push({ sender: "admin", text: messageText })
    convo.lastMessageAt = new Date()

    // Admin has the conversation open, so admin unread count stays cleared.
    convo.unreadForAdmin = false
    convo.unreadAdminCount = 0

    // Customer now has one more unread reply.
    convo.unreadForCustomer = true
    convo.unreadCustomerCount = Number(convo.unreadCustomerCount || 0) + 1

    await convo.save()

    try {
      await Promise.resolve(
        notifyUser(convo.customer, {
          type: "chat_reply",
          title: "Nytt svar fra ProVisuell",
          message: messageText.slice(0, 80),
          link: "/",
        })
      )
    } catch (notificationError) {
      console.error("Customer notification failed:", notificationError)
    }

    return NextResponse.json({ conversation: convo, sentMessage: messageText })
  } catch (error) {
    console.error("POST /messages/:id failed:", error)
    return NextResponse.json({ error: "Failed to send reply" }, { status: 500 })
  }
})
