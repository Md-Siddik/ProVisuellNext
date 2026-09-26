import { NextResponse } from "next/server"
import { ApiError, authenticate, withApiErrors } from "@/lib/auth"
import { isCommentModerator } from "@/lib/blog/access"
import { COMMENT_MAX_LENGTH, serializeComment } from "@/lib/blog/comments"
import { assertObjectId, recountComments } from "@/lib/blog/mutations"
import { cleanCommentText } from "@/lib/blog/sanitize"
import { BlogComment } from "@/lib/models/BlogComment"

const STATUSES = ["approved", "pending", "hidden", "spam"]

// Staff may change a comment's status (moderation). The author may edit the
// text of their own comment. Everyone else gets 403.
export const PATCH = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const auth = await authenticate(request)
  const { user } = auth
  assertObjectId(id)
  const comment = await BlogComment.findById(id)
  if (!comment) throw new ApiError(404, "Not found")

  const staff = isCommentModerator(auth)
  const mine = String(comment.user) === String(user._id)
  const payload = await request.json().catch(() => ({}))

  if (payload.status !== undefined) {
    if (!staff) throw new ApiError(403, "Not allowed for your role")
    if (!STATUSES.includes(payload.status)) throw new ApiError(400, "Invalid status")
    comment.status = payload.status
    // Hiding a comment hides the replies under it too (they would be orphaned).
    if (!comment.parent && ["hidden", "spam", "pending"].includes(payload.status)) {
      await BlogComment.updateMany({ parent: comment._id, status: "approved" }, { status: payload.status })
    }
  }
  if (payload.body !== undefined) {
    if (!mine) throw new ApiError(403, "Not allowed for your role")
    const body = cleanCommentText(payload.body)
    if (!body) throw new ApiError(400, "Comment cannot be empty")
    if (body.length > COMMENT_MAX_LENGTH) throw new ApiError(400, "Comment is too long")
    comment.body = body
    comment.editedAt = new Date()
  }
  await comment.save()
  await recountComments(comment.post)
  return NextResponse.json({ comment: serializeComment(comment, user._id) })
})

export const DELETE = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const auth = await authenticate(request)
  const { user } = auth
  assertObjectId(id)
  const comment = await BlogComment.findById(id)
  if (!comment) throw new ApiError(404, "Not found")
  if (!isCommentModerator(auth) && String(comment.user) !== String(user._id)) throw new ApiError(403, "Not allowed for your role")
  await BlogComment.deleteMany({ $or: [{ _id: comment._id }, { parent: comment._id }] })
  await recountComments(comment.post)
  return new Response(null, { status: 204 })
})
