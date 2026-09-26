import { NextResponse } from "next/server"
import { withApiErrors } from "@/lib/auth"
import { requireBlogAdmin } from "@/lib/blog/access"
import { BlogCategory } from "@/lib/models/BlogCategory"
import { BlogPost } from "@/lib/models/BlogPost"
import { BlogTag } from "@/lib/models/BlogTag"

// All categories and tags (including unused ones) with how many posts use
// each, for the management screens and the post editor's pickers.
export const GET = withApiErrors(async (request) => {
  await requireBlogAdmin(request, "blog.view")
  const [categories, tags, categoryCounts, tagCounts] = await Promise.all([
    BlogCategory.find().sort({ name: 1 }).lean(),
    BlogTag.find().sort({ name: 1 }).lean(),
    BlogPost.aggregate([{ $match: { category: { $ne: null } } }, { $group: { _id: "$category", count: { $sum: 1 } } }]),
    BlogPost.aggregate([{ $unwind: "$tags" }, { $group: { _id: "$tags", count: { $sum: 1 } } }]),
  ])
  const cCount = new Map(categoryCounts.map((c) => [String(c._id), c.count]))
  const tCount = new Map(tagCounts.map((t) => [t._id, t.count]))
  return NextResponse.json({
    categories: categories.map((c) => ({
      _id: String(c._id),
      name: c.name,
      slug: c.slug,
      description: c.description || "",
      postCount: cCount.get(String(c._id)) || 0,
    })),
    tags: tags.map((t) => ({ _id: String(t._id), name: t.name, slug: t.slug, postCount: tCount.get(t.slug) || 0 })),
  })
})
