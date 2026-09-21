import { BlogComment } from "@/lib/models/BlogComment"

export const COMMENT_MAX_LENGTH = 1000

// What a visitor is allowed to see of a comment: the display name/avatar and
// text only — never the user id or any private data.
export function serializeComment(c, meId = null) {
  return {
    _id: String(c._id),
    userName: c.userName || "",
    userAvatar: c.userAvatar || "",
    body: c.body,
    status: c.status,
    parent: c.parent ? String(c.parent) : null,
    createdAt: new Date(c.createdAt).toISOString(),
    editedAt: c.editedAt ? new Date(c.editedAt).toISOString() : null,
    mine: Boolean(meId && String(c.user) === String(meId)),
  }
}

// Public visibility: approved comments, plus the viewer's own pending ones
// (so they can see it is waiting for approval).
export function visibleCommentFilter(meId) {
  return meId ? { $or: [{ status: "approved" }, { status: "pending", user: meId }] } : { status: "approved" }
}

// Comment tree for one page of top-level comments (replies fetched in a single
// extra query, not one per comment).
export async function loadCommentPage(postId, { page, limit, meId }) {
  const visible = visibleCommentFilter(meId)
  const topFilter = { post: postId, parent: null, ...visible }
  const [total, tops] = await Promise.all([
    BlogComment.countDocuments(topFilter),
    BlogComment.find(topFilter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ])
  const replies = tops.length
    ? await BlogComment.find({ post: postId, parent: { $in: tops.map((c) => c._id) }, ...visible })
        .sort({ createdAt: 1 })
        .lean()
    : []
  const byParent = new Map()
  for (const r of replies) {
    const key = String(r.parent)
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(serializeComment(r, meId))
  }
  const comments = tops.map((c) => ({ ...serializeComment(c, meId), replies: byParent.get(String(c._id)) || [] }))
  return { comments, total, page, hasMore: page * limit < total }
}
