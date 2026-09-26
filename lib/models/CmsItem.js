import mongoose from "mongoose"
import { registerModel } from "./registerModel.js"

// One reusable model backs every dynamic collection (services, portfolio
// items, featured projects) instead of a bespoke schema per section.
// `translations` maps a field name (e.g. "name", "description") to a
// { no, en, sv, fi, da } object — editing one language never touches the
// others since updates merge into a single language key at a time.
const cmsItemSchema = new mongoose.Schema(
  {
    collectionKey: { type: String, required: true, index: true }, // "services" | "portfolioItems" | "featuredProjects"
    order: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
    translations: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
    link: { type: String, default: "" }, // CTA link / project link — shared across languages
    image: { type: String, default: "" }, // shared across languages
    video: { type: String, default: "" }, // shared across languages, optional
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
)

cmsItemSchema.index({ collectionKey: 1, order: 1 })

export const CmsItem = registerModel("CmsItem", cmsItemSchema)
