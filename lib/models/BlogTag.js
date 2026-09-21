import mongoose from "mongoose"

// The slug is the identity: "Tint", "tint" and " TINT " all slugify to the
// same value, so the unique index is what stops case-variant duplicates.
const blogTagSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  },
  { timestamps: true }
)

export const BlogTag = mongoose.models.BlogTag || mongoose.model("BlogTag", blogTagSchema)
