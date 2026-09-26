import { NextResponse } from "next/server"
import { ApiError, withApiErrors } from "@/lib/auth"
import { assertCanPublish, isBlogAdmin, optionalAuth, requireBlogAdmin } from "@/lib/blog/access"
import { assertObjectId, buildPostFields } from "@/lib/blog/mutations"
import { categoryMapFor, findPublicPost, serializePost } from "@/lib/blog/queries"
import { BlogComment } from "@/lib/models/BlogComment"
import { BlogLike } from "@/lib/models/BlogLike"
import { BlogPost } from "@/lib/models/BlogPost"
import { connectDB } from "@/lib/db"

// `id` is an ObjectId or a slug for reading; mutations require the ObjectId.
// Public visitors only ever get live posts; staff can also read drafts.
export const GET = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const auth = await optionalAuth(request)
  let doc = await findPublicPost(id)
  if (!doc && isBlogAdmin(auth)) {
    doc = /^[a-f0-9]{24}$/i.test(id) ? await BlogPost.findById(id).lean() : await BlogPost.findOne({ slug: id.toLowerCase() }).lean()
  }
  if (!doc) throw new ApiError(404, "Not found")
  const post = serializePost(doc, await categoryMapFor([doc]), { withContent: true })
  const liked = auth ? Boolean(await BlogLike.exists({ post: doc._id, user: auth.user._id })) : false
  return NextResponse.json({ post, liked })
})

export const PATCH = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const auth = await requireBlogAdmin(request, "blog.edit")
  assertObjectId(id)
  const existing = await BlogPost.findById(id)
  if (!existing) throw new ApiError(404, "Not found")

  const body = await request.json().catch(() => ({}))
  const fields = await buildPostFields(body, existing)
  assertCanPublish(auth, fields.status, existing.status)

  // A renamed slug keeps working: the old one is remembered and redirects.
  if (fields.slug && fields.slug !== existing.slug) {
    fields.previousSlugs = [...new Set([...existing.previousSlugs.filter((s) => s !== fields.slug), existing.slug])]
  }
  try {
    const post = await BlogPost.findByIdAndUpdate(id, { $set: fields }, { new: true, runValidators: true })
    return NextResponse.json({ post: { _id: String(post._id), slug: post.slug, status: post.status } })
  } catch (err) {
    if (err?.code === 11000) throw new ApiError(409, "Slug already in use")
    throw err
  }
})

export const DELETE = withApiErrors(async (request, { params }) => {
  const { id } = await params
  await requireBlogAdmin(request, "blog.delete")
  assertObjectId(id)
  await connectDB()
  const post = await BlogPost.findByIdAndDelete(id)
  if (!post) throw new ApiError(404, "Not found")
  await Promise.all([BlogComment.deleteMany({ post: id }), BlogLike.deleteMany({ post: id })])
  return new Response(null, { status: 204 })
})
