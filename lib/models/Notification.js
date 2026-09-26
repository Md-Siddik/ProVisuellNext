import mongoose from "mongoose"
import { registerModel } from "./registerModel.js"

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, default: "" },
    link: { type: String, default: "" },
    // Structured values for display-time translation (see NotificationBell).
    data: { type: mongoose.Schema.Types.Mixed, default: null },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
)

// Bell badge (unread count) and list, per user, newest first.
notificationSchema.index({ user: 1, read: 1, createdAt: -1 })

export const Notification = registerModel("Notification", notificationSchema)
