import { NextResponse } from "next/server"
import { ApiError, withApiErrors } from "@/lib/auth"
import { requireBlogAdmin } from "@/lib/blog/access"
import { assertObjectId } from "@/lib/blog/mutations"
import { BlogPost } from "@/lib/models/BlogPost"

// The full editable document (any status) for the post editor.
export const GET = withApiErrors(async (request, { params }) => {
  const { id } = await params
  await requireBlogAdmin(request)
  assertObjectId(id)
  const p = await BlogPost.findById(id).select("-plainText").lean()
  if (!p) throw new ApiError(404, "Not found")
  return NextResponse.json({
    post: {
      _id: String(p._id),
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt || "",
      content: p.content || "",
      coverImage: p.coverImage || "",
      coverImageAlt: p.coverImageAlt || "",
      featuredVideo: p.featuredVideo || "",
      category: p.category ? String(p.category) : "",
      tags: p.tags || [],
      status: p.status,
      featured: Boolean(p.featured),
      seoTitle: p.seoTitle || "",
      seoDescription: p.seoDescription || "",
      scheduledAt: p.scheduledAt ? new Date(p.scheduledAt).toISOString() : null,
      publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString() : null,
      author: { name: p.author?.name || "" },
    },
  })
})
