import { NextResponse } from "next/server"
import { ApiError, withApiErrors } from "@/lib/auth"
import { requireBlogAdmin } from "@/lib/blog/access"
import { assertObjectId } from "@/lib/blog/mutations"
import { slugify } from "@/lib/blog/utils"
import { BlogCategory } from "@/lib/models/BlogCategory"
import { BlogPost } from "@/lib/models/BlogPost"

export const PATCH = withApiErrors(async (request, { params }) => {
  const { id } = await params
  await requireBlogAdmin(request)
  assertObjectId(id)
  const category = await BlogCategory.findById(id)
  if (!category) throw new ApiError(404, "Not found")
  const body = (await request.json().catch(() => ({}))) || {}

  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, 80)
    if (!name) throw new ApiError(400, "Name is required")
    category.name = name
  }
  if (body.slug !== undefined) {
    const slug = slugify(body.slug)
    if (!slug) throw new ApiError(400, "Slug is required")
    if (await BlogCategory.exists({ slug, _id: { $ne: category._id } })) throw new ApiError(409, "Slug already in use")
    category.slug = slug
  }
  if (body.description !== undefined) category.description = String(body.description).trim().slice(0, 300)
  await category.save()
  return NextResponse.json({ category })
})

// Posts in a deleted category simply become uncategorised.
export const DELETE = withApiErrors(async (request, { params }) => {
  const { id } = await params
  await requireBlogAdmin(request)
  assertObjectId(id)
  const category = await BlogCategory.findByIdAndDelete(id)
  if (!category) throw new ApiError(404, "Not found")
  const { modifiedCount } = await BlogPost.updateMany({ category: id }, { category: null })
  return NextResponse.json({ ok: true, uncategorised: modifiedCount })
})
