import mongoose from "mongoose"
import { registerModel } from "./registerModel.js"

// One document per message submitted through the public "Send email" form,
// kept so staff can read it in the dashboard (the mail itself only lands in
// the business inbox).
const replySchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    time: { type: Date, default: Date.now },
    sentBy: { type: String, default: "" },
  },
  { _id: true }
)

const contactEmailSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false, index: true },
    replies: [replySchema],
  },
  { timestamps: true }
)

contactEmailSchema.index({ createdAt: -1 })

export const ContactEmail = registerModel("ContactEmail", contactEmailSchema)
