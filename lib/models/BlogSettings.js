import mongoose from "mongoose"
import { registerModel } from "./registerModel.js"

// A single document (key "main") holding blog-wide switches.
const blogSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "main", unique: true },
    // When on, new comments wait as "pending" until staff approve them.
    requireCommentApproval: { type: Boolean, default: false },
  },
  { timestamps: true }
)

export const BlogSettings = registerModel("BlogSettings", blogSettingsSchema)
