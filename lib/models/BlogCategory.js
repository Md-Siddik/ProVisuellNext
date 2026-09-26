import mongoose from "mongoose"
import { registerModel } from "./registerModel.js"

const blogCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "", maxlength: 300 },
  },
  { timestamps: true }
)

export const BlogCategory = registerModel("BlogCategory", blogCategorySchema)
