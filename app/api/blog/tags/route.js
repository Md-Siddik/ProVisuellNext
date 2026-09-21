import { NextResponse } from "next/server"
import { ApiError, withApiErrors } from "@/lib/auth"
import { requireBlogAdmin } from "@/lib/blog/access"
import { getPublicTags } from "@/lib/blog/queries"
import { slugify } from "@/lib/blog/utils"
import { BlogTag } from "@/lib/models/BlogTag"

// Public: the most used tags among live posts.
export const GET = withApiErrors(async () => NextResponse.json({ tags: await getPublicTags(20) }))

export const POST = withApiErrors(async (request) => {
  await requireBlogAdmin(request)
  const body = (await request.json().catch(() => ({}))) || {}
  const name = String(body.name || "").trim().slice(0, 40)
  const slug = slugify(name)
  if (!name || !slug) throw new ApiError(400, "Name is required")
  if (await BlogTag.exists({ slug })) throw new ApiError(409, "Tag already exists")
  const tag = await BlogTag.create({ name, slug })
  return NextResponse.json({ tag }, { status: 201 })
})
