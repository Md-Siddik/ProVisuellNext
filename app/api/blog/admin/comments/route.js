import { NextResponse } from "next/server"
import mongoose from "mongoose"
import { withApiErrors } from "@/lib/auth"
import { requireBlogAdmin } from "@/lib/blog/access"
import { escapeRegex, toInt } from "@/lib/blog/utils"
import { BlogComment } from "@/lib/models/BlogComment"
import { BlogPost } from "@/lib/models/BlogPost"

// Moderation queue: every comment in every status, with the post it belongs to.
export const GET = withApiErrors(async (request) => {
  await requireBlogAdmin(request)
  const sp = new URL(request.url).searchParams
  const filter = {}
  if (["approved", "pending", "hidden", "spam"].includes(sp.get("status"))) filter.status = sp.get("status")
  if (sp.get("post") && mongoose.isValidObjectId(sp.get("post"))) filter.post = sp.get("post")
  const q = (sp.get("q") || "").trim().slice(0, 80)
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i")
    filter.$or = [{ body: rx }, { userName: rx }]
  }
  const page = toInt(sp.get("page"), 1, { max: 1000 })
  const limit = toInt(sp.get("limit"), 15, { max: 50 })
  const [total, docs] = await Promise.all([
    BlogComment.countDocuments(filter),
    BlogComment.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ])
  const posts = await BlogPost.find({ _id: { $in: [...new Set(docs.map((c) => String(c.post)))] } })
    .select("title slug")
    .lean()
  const postById = new Map(posts.map((p) => [String(p._id), p]))
  const comments = docs.map((c) => ({
    _id: String(c._id),
    userName: c.userName,
    body: c.body,
    status: c.status,
    isReply: Boolean(c.parent),
    createdAt: new Date(c.createdAt).toISOString(),
    post: postById.has(String(c.post))
      ? { _id: String(c.post), title: postById.get(String(c.post)).title, slug: postById.get(String(c.post)).slug }
      : null,
  }))
  return NextResponse.json({ comments, total, page, pages: Math.max(1, Math.ceil(total / limit)) })
})
