import mongoose from "mongoose"
import { registerModel } from "./registerModel.js"

const blogCommentSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: "BlogPost", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Snapshot of just what is displayed — no email or other private data.
    userName: { type: String, default: "" },
    userAvatar: { type: String, default: "" },
    // Plain text only: rendered as text, never as HTML.
    body: { type: String, required: true, maxlength: 1000 },
    status: { type: String, enum: ["approved", "pending", "hidden", "spam"], default: "approved", index: true },
    // One level of replies only: a reply's parent is always a top-level comment.
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "BlogComment", default: null, index: true },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

blogCommentSchema.index({ post: 1, status: 1, createdAt: -1 })

export const BlogComment = registerModel("BlogComment", blogCommentSchema)
