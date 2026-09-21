// Shared by app/api/messages/mine and app/api/messages/mine/typing. Ported
// verbatim from Server/src/routes/messages.js's own helper.
import { Conversation } from "./models/Conversation"

export async function getOrCreateOwnConversation(user) {
  let convo = await Conversation.findOne({
    customer: user._id,
  })

  if (!convo) {
    convo = await Conversation.create({
      customer: user._id,
      customerName: user.name || user.email,
      customerEmail: user.email,
      messages: [],
      unreadForAdmin: false,
      unreadForCustomer: false,
      unreadAdminCount: 0,
      unreadCustomerCount: 0,
      lastMessageAt: new Date(),
      typing: {
        user: null,
        admin: null,
      },
    })
  } else {
    let changed = false

    if (user.name && convo.customerName !== user.name) {
      convo.customerName = user.name
      changed = true
    }

    if (user.email && convo.customerEmail !== user.email) {
      convo.customerEmail = user.email
      changed = true
    }

    if (typeof convo.unreadAdminCount !== "number") {
      convo.unreadAdminCount = 0
      changed = true
    }

    if (typeof convo.unreadCustomerCount !== "number") {
      convo.unreadCustomerCount = 0
      changed = true
    }

    if (changed) {
      await convo.save()
    }
  }

  return convo
}
