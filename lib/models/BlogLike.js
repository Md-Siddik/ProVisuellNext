import mongoose from "mongoose"

const blogLikeSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: "BlogPost", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

// The database itself guarantees one like per user per post, so two racing
// requests can never create a duplicate.
blogLikeSchema.index({ post: 1, user: 1 }, { unique: true })

export const BlogLike = mongoose.models.BlogLike || mongoose.model("BlogLike", blogLikeSchema)
