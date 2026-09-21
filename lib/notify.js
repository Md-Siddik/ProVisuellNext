import { Notification } from "./models/Notification.js"
import { User } from "./models/User.js"

// Best-effort — a notification failing to save should never break the
// request that triggered it.
export async function notifyUser(userId, { type, title, message = "", link = "" }) {
  if (!userId) return
  try {
    await Notification.create({ user: userId, type, title, message, link })
  } catch (err) {
    console.error("Failed to create notification:", err.message)
  }
}

export async function notifyRole(role, { type, title, message = "", link = "" }) {
  try {
    const users = await User.find({ role }).select("_id")
    if (users.length === 0) return
    await Notification.insertMany(users.map((u) => ({ user: u._id, type, title, message, link })))
  } catch (err) {
    console.error("Failed to create role notification:", err.message)
  }
}
