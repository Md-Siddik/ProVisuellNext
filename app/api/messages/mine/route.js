import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"
import { notifyRole } from "@/lib/notify"
import { notifyBusiness } from "@/lib/mailer"
import { getOrCreateOwnConversation } from "@/lib/messageHelpers"

// Opening the chat marks admin replies as read.
export const GET = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  try {
    const convo = await getOrCreateOwnConversation(user)
    if (convo.unreadForCustomer || convo.unreadCustomerCount > 0) {
      convo.unreadForCustomer = false
      convo.unreadCustomerCount = 0
      await convo.save()
    }
    return NextResponse.json({ conversation: convo })
  } catch (error) {
    console.error("GET /messages/mine failed:", error)
    return NextResponse.json({ error: "Failed to load conversation" }, { status: 500 })
  }
})

// IMPORTANT: we store exactly the text received from the frontend. "Hi"
// stays "Hi". There is no translation, replacement or default message here.
export const POST = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  try {
    const body = (await request.json().catch(() => ({}))) || {}
    const rawText = typeof body.text === "string" ? body.text : ""
    const messageText = rawText.trim()

    if (!messageText) {
      return NextResponse.json({ error: "text is required" }, { status: 400 })
    }

    const convo = await getOrCreateOwnConversation(user)

    convo.messages.push({ sender: "user", text: messageText })
    convo.lastMessageAt = new Date()
    convo.unreadForAdmin = true
    convo.unreadAdminCount = Number(convo.unreadAdminCount || 0) + 1
    await convo.save()

    const notificationMessage = `${convo.customerName}: ${messageText.slice(0, 80)}`

    try {
      await Promise.resolve(
        notifyRole("owner", {
          type: "chat_message",
          title: "Ny melding fra kunde",
          message: notificationMessage,
          link: "/dashboard/owner/meldinger",
        })
      )
      await Promise.resolve(
        notifyRole("administrator", {
          type: "chat_message",
          title: "Ny melding fra kunde",
          message: notificationMessage,
          link: "/dashboard/admin/meldinger",
        })
      )
      await Promise.resolve(
        notifyRole("moderator", {
          type: "chat_message",
          title: "Ny melding fra kunde",
          message: notificationMessage,
          link: "/dashboard/admin/meldinger",
        })
      )
    } catch (notificationError) {
      console.error("Chat notification failed:", notificationError)
    }

    // Best-effort heads-up to the business inbox — silently skipped if
    // SMTP isn't configured.
    const dashboardBase = process.env.CLIENT_URL || ""
    notifyBusiness({
      subject: `Ny melding fra ${convo.customerName}`,
      text: `Kunde: ${convo.customerName}\nE-post: ${convo.customerEmail || "—"}\nMelding: ${messageText}${dashboardBase ? `\n\nÅpne i dashboard: ${dashboardBase}/dashboard/admin/meldinger` : ""}`,
    })

    return NextResponse.json({ conversation: convo, sentMessage: messageText }, { status: 201 })
  } catch (error) {
    console.error("POST /messages/mine failed:", error)
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
})
