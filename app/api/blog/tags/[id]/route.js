import { NextResponse } from "next/server"
import { ApiError, withApiErrors } from "@/lib/auth"
import { requireBlogAdmin } from "@/lib/blog/access"
import { assertObjectId } from "@/lib/blog/mutations"
import { slugify } from "@/lib/blog/utils"
import { BlogPost } from "@/lib/models/BlogPost"
import { BlogTag } from "@/lib/models/BlogTag"

// Renaming a tag re-points every post that used it.
export const PATCH = withApiErrors(async (request, { params }) => {
  const { id } = await params
  await requireBlogAdmin(request)
  assertObjectId(id)
  const tag = await BlogTag.findById(id)
  if (!tag) throw new ApiError(404, "Not found")
  const body = (await request.json().catch(() => ({}))) || {}
  const name = String(body.name || "").trim().slice(0, 40)
  const slug = slugify(name)
  if (!name || !slug) throw new ApiError(400, "Name is required")
  if (await BlogTag.exists({ slug, _id: { $ne: tag._id } })) throw new ApiError(409, "Tag already exists")

  const oldSlug = tag.slug
  tag.name = name
  tag.slug = slug
  await tag.save()
  if (oldSlug !== slug) {
    await BlogPost.updateMany({ tags: oldSlug }, { $addToSet: { tags: slug } })
    await BlogPost.updateMany({ tags: oldSlug }, { $pull: { tags: oldSlug } })
  }
  return NextResponse.json({ tag })
})

export const DELETE = withApiErrors(async (request, { params }) => {
  const { id } = await params
  await requireBlogAdmin(request)
  assertObjectId(id)
  const tag = await BlogTag.findByIdAndDelete(id)
  if (!tag) throw new ApiError(404, "Not found")
  await BlogPost.updateMany({ tags: tag.slug }, { $pull: { tags: tag.slug } })
  return NextResponse.json({ ok: true })
})
