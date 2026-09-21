import mongoose from "mongoose"

const blogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Old slugs are kept so a renamed article's previous URL still resolves
    // (it redirects to the current one) instead of turning into a 404.
    previousSlugs: { type: [String], default: [], index: true },
    excerpt: { type: String, default: "", maxlength: 400 },
    // Sanitized HTML (see lib/blog/sanitize.js) — sanitized again on render.
    content: { type: String, default: "" },
    // Tag-stripped copy of `content`: powers search and reading time without
    // parsing HTML on every request.
    plainText: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    coverImageAlt: { type: String, default: "", maxlength: 200 },
    featuredVideo: { type: String, default: "" },
    // Always taken from the authenticated user on the server, never from the request body.
    author: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, default: "" },
      avatar: { type: String, default: "" },
    },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "BlogCategory", default: null, index: true },
    // Tag slugs (BlogTag.slug) — kept as plain strings so listing needs no join.
    tags: { type: [String], default: [], index: true },
    status: { type: String, enum: ["draft", "published", "scheduled", "archived"], default: "draft", index: true },
    featured: { type: Boolean, default: false, index: true },
    seoTitle: { type: String, default: "", maxlength: 120 },
    seoDescription: { type: String, default: "", maxlength: 300 },
    publishedAt: { type: Date, default: null },
    scheduledAt: { type: Date, default: null },
    readingTime: { type: Number, default: 1 },
    // Denormalised counters, only ever changed with atomic $inc / recounts.
    likeCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
)

blogPostSchema.index({ status: 1, publishedAt: -1 })

export const BlogPost = mongoose.models.BlogPost || mongoose.model("BlogPost", blogPostSchema)
