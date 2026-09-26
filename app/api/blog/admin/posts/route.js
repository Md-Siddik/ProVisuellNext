import { NextResponse } from "next/server"
import mongoose from "mongoose"
import { withApiErrors } from "@/lib/auth"
import { requireBlogAdmin } from "@/lib/blog/access"
import { categoryMapFor, serializePost } from "@/lib/blog/queries"
import { escapeRegex, toInt } from "@/lib/blog/utils"
import { BlogPost } from "@/lib/models/BlogPost"

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  updated: { updatedAt: -1 },
  published: { publishedAt: -1 },
  likes: { likeCount: -1, createdAt: -1 },
  comments: { commentCount: -1, createdAt: -1 },
  title: { title: 1 },
}

// Management list: every status, paginated, no article bodies.
export const GET = withApiErrors(async (request) => {
  await requireBlogAdmin(request, "blog.view")
  const sp = new URL(request.url).searchParams
  const filter = {}
  const status = sp.get("status")
  if (["draft", "published", "scheduled", "archived"].includes(status)) filter.status = status
  if (sp.get("category") && mongoose.isValidObjectId(sp.get("category"))) filter.category = sp.get("category")
  if (sp.get("featured") === "1") filter.featured = true
  const q = (sp.get("q") || "").trim().slice(0, 80)
  if (q) filter.title = new RegExp(escapeRegex(q), "i")

  const page = toInt(sp.get("page"), 1, { max: 1000 })
  const limit = toInt(sp.get("limit"), 12, { max: 50 })
  const sort = SORTS[sp.get("sort")] || SORTS.newest
  const [total, docs] = await Promise.all([
    BlogPost.countDocuments(filter),
    BlogPost.find(filter)
      .select("-content -plainText -previousSlugs")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ])
  const categories = await categoryMapFor(docs)
  const posts = docs.map((d) => ({
    ...serializePost(d, categories),
    // The raw stored status (a due "scheduled" post reads as published in `status`).
    storedStatus: d.status,
    scheduledAt: d.scheduledAt ? new Date(d.scheduledAt).toISOString() : null,
    createdAt: new Date(d.createdAt).toISOString(),
  }))
  return NextResponse.json({ posts, total, page, pages: Math.max(1, Math.ceil(total / limit)) })
})
