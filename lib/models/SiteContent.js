import mongoose from "mongoose"
import { registerModel } from "./registerModel.js"

// One row per (contentKey, language) pair for text; images/video use
// language: null since they're shared across all languages by default.
const siteContentSchema = new mongoose.Schema(
  {
    contentKey: { type: String, required: true }, // e.g. "hero.titleLine1", "pillars.brandifyImage"
    type: { type: String, enum: ["text", "image", "video"], default: "text" },
    language: { type: String, default: null }, // "no" | "en" | "sv" | "fi" | "da" | "ro" | null (images/video)
    value: { type: String, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
)

siteContentSchema.index({ contentKey: 1, language: 1 }, { unique: true })

export const SiteContent = registerModel("SiteContent", siteContentSchema)
