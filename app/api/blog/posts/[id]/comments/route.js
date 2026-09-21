import { NextResponse } from "next/server"
import mongoose from "mongoose"
import { ApiError, authenticate, withApiErrors } from "@/lib/auth"
import { identityOf, isBlogAdmin, optionalAuth } from "@/lib/blog/access"
import { COMMENT_MAX_LENGTH, loadCommentPage, serializeComment } from "@/lib/blog/comments"
import { getSettings, recountComments } from "@/lib/blog/mutations"
import { findPublicPost } from "@/lib/blog/queries"
import { cleanCommentText } from "@/lib/blog/sanitize"
import { toInt } from "@/lib/blog/utils"
import { BlogComment } from "@/lib/models/BlogComment"

export const GET = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const post = await findPublicPost(id)
  if (!post) throw new ApiError(404, "Not found")
  const auth = await optionalAuth(request)
  const sp = new URL(request.url).searchParams
  const data = await loadCommentPage(post._id, {
    page: toInt(sp.get("page"), 1, { max: 1000 }),
    limit: toInt(sp.get("limit"), 10, { max: 30 }),
    meId: auth?.user._id || null,
  })
  return NextResponse.json(data)
})

// Login required. The commenter's identity comes from the verified token /
// user record, never from the request body.
export const POST = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const auth = await authenticate(request)
  const post = await findPublicPost(id)
  if (!post) throw new ApiError(404, "Not found")

  const payload = await request.json().catch(() => ({}))
  const body = cleanCommentText(payload?.body)
  if (!body) throw new ApiError(400, "Comment cannot be empty")
  if (body.length > COMMENT_MAX_LENGTH) throw new ApiError(400, "Comment is too long")

  // Light spam brake: at most 5 comments a minute per user.
  const recent = await BlogComment.countDocuments({ user: auth.user._id, createdAt: { $gt: new Date(Date.now() - 60_000) } })
  if (recent >= 5) throw new ApiError(429, "Too many comments — please wait a moment")

  // One level of replies: the parent must be a visible top-level comment on this post.
  let parent = null
  if (payload?.parent) {
    if (!mongoose.isValidObjectId(payload.parent)) throw new ApiError(400, "Invalid reply target")
    const target = await BlogComment.findOne({ _id: payload.parent, post: post._id, parent: null, status: "approved" }).select("_id").lean()
    if (!target) throw new ApiError(400, "Invalid reply target")
    parent = target._id
  }

  const { requireCommentApproval } = await getSettings()
  const staff = isBlogAdmin(auth.user)
  const { name, avatar } = identityOf(auth)
  const comment = await BlogComment.create({
    post: post._id,
    user: auth.user._id,
    userName: name,
    userAvatar: avatar,
    body,
    parent,
    status: requireCommentApproval && !staff ? "pending" : "approved",
  })
  await recountComments(post._id)
  return NextResponse.json({ comment: serializeComment(comment, auth.user._id) }, { status: 201 })
})
