import { NextResponse } from "next/server"
import { ApiError, withApiErrors } from "@/lib/auth"
import { requireBlogAdmin } from "@/lib/blog/access"
import { getPublicCategories } from "@/lib/blog/queries"
import { slugify } from "@/lib/blog/utils"
import { BlogCategory } from "@/lib/models/BlogCategory"

// Public: categories that currently have at least one live post.
export const GET = withApiErrors(async () => NextResponse.json({ categories: await getPublicCategories() }))

export const POST = withApiErrors(async (request) => {
  await requireBlogAdmin(request)
  const body = (await request.json().catch(() => ({}))) || {}
  const name = String(body.name || "").trim().slice(0, 80)
  if (!name) throw new ApiError(400, "Name is required")
  const slug = slugify(body.slug || name)
  if (!slug) throw new ApiError(400, "Slug is required")
  if (await BlogCategory.exists({ slug })) throw new ApiError(409, "Slug already in use")
  const category = await BlogCategory.create({ name, slug, description: String(body.description || "").trim().slice(0, 300) })
  return NextResponse.json({ category }, { status: 201 })
})
