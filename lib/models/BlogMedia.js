import mongoose from "mongoose"

const blogMediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, unique: true },
    type: { type: String, enum: ["image", "video"], required: true, index: true },
    fileName: { type: String, default: "" },
    size: { type: Number, default: 0 },
    mimeType: { type: String, default: "" },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
)

export const BlogMedia = mongoose.models.BlogMedia || mongoose.model("BlogMedia", blogMediaSchema)
