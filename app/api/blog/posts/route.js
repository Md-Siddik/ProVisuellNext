import { NextResponse } from "next/server"
import { ApiError, withApiErrors } from "@/lib/auth"
import { identityOf, requireBlogAdmin } from "@/lib/blog/access"
import { buildPostFields } from "@/lib/blog/mutations"
import { listPublicPosts } from "@/lib/blog/queries"
import { toInt } from "@/lib/blog/utils"
import { BlogPost } from "@/lib/models/BlogPost"

// Public: only live posts, paginated, without the article body.
export const GET = withApiErrors(async (request) => {
  const sp = new URL(request.url).searchParams
  const data = await listPublicPosts({
    q: sp.get("q") || "",
    category: sp.get("category") || "",
    tag: sp.get("tag") || "",
    page: toInt(sp.get("page"), 1, { max: 1000 }),
    limit: toInt(sp.get("limit"), 9, { max: 24 }),
  })
  return NextResponse.json(data)
})

// Admin/owner only. The author is the authenticated user — never the body.
export const POST = withApiErrors(async (request) => {
  const auth = await requireBlogAdmin(request)
  const body = await request.json().catch(() => ({}))
  const fields = await buildPostFields(body)
  const { name, avatar } = identityOf(auth)
  try {
    const post = await BlogPost.create({ ...fields, author: { user: auth.user._id, name, avatar } })
    return NextResponse.json({ post: { _id: String(post._id), slug: post.slug, status: post.status } }, { status: 201 })
  } catch (err) {
    if (err?.code === 11000) throw new ApiError(409, "Slug already in use")
    throw err
  }
})
