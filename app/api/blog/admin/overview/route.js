import { NextResponse } from "next/server"
import { withApiErrors } from "@/lib/auth"
import { publicPostFilter, requireBlogAdmin } from "@/lib/blog/access"
import { BlogComment } from "@/lib/models/BlogComment"
import { BlogLike } from "@/lib/models/BlogLike"
import { BlogPost } from "@/lib/models/BlogPost"

const DAY = 24 * 60 * 60 * 1000

function dayKey(d) {
  return new Date(d).toISOString().slice(0, 10)
}

// One call feeds both the Overview and Analytics screens. Everything comes
// from the blog's own collections — no separate tracking.
export const GET = withApiErrors(async (request) => {
  await requireBlogAdmin(request, "blog.analytics", "blog.view")
  const now = new Date()
  const since = new Date(now.getTime() - 13 * DAY)
  since.setUTCHours(0, 0, 0, 0)
  const monthsBack = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1))

  const [byStatus, dueScheduled, totalComments, pendingComments, totalLikes, recentPosts, recentComments, mostLiked, mostCommented, byMonth, likesByDay, commentsByDay] =
    await Promise.all([
      BlogPost.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      BlogPost.countDocuments({ status: "scheduled", scheduledAt: { $lte: now } }),
      BlogComment.countDocuments(),
      BlogComment.countDocuments({ status: "pending" }),
      BlogLike.countDocuments(),
      BlogPost.find().select("title slug status scheduledAt updatedAt").sort({ updatedAt: -1 }).limit(5).lean(),
      BlogComment.find().sort({ createdAt: -1 }).limit(5).lean(),
      BlogPost.find({ likeCount: { $gt: 0 } }).select("title slug likeCount").sort({ likeCount: -1 }).limit(5).lean(),
      BlogPost.find({ commentCount: { $gt: 0 } }).select("title slug commentCount").sort({ commentCount: -1 }).limit(5).lean(),
      BlogPost.aggregate([
        { $match: { $and: [publicPostFilter(now), { publishedAt: { $gte: monthsBack } }] } },
        { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$publishedAt" } }, count: { $sum: 1 } } },
      ]),
      BlogLike.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      ]),
      BlogComment.aggregate([
        { $match: { createdAt: { $gte: since }, status: "approved" } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      ]),
    ])

  const statusCount = Object.fromEntries(byStatus.map((s) => [s._id, s.count]))
  const totals = {
    posts: byStatus.reduce((sum, s) => sum + s.count, 0),
    // A scheduled post whose time has passed is already live.
    published: (statusCount.published || 0) + dueScheduled,
    draft: statusCount.draft || 0,
    scheduled: Math.max(0, (statusCount.scheduled || 0) - dueScheduled),
    archived: statusCount.archived || 0,
    comments: totalComments,
    pendingComments,
    likes: totalLikes,
  }

  const monthCounts = new Map(byMonth.map((m) => [m._id, m.count]))
  const publishedOverTime = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 1))
    const key = d.toISOString().slice(0, 7)
    return { month: key, posts: monthCounts.get(key) || 0 }
  })

  const likeCounts = new Map(likesByDay.map((d) => [d._id, d.count]))
  const commentCounts = new Map(commentsByDay.map((d) => [d._id, d.count]))
  const engagement = Array.from({ length: 14 }, (_, i) => {
    const key = dayKey(new Date(since.getTime() + i * DAY))
    return { date: key, likes: likeCounts.get(key) || 0, comments: commentCounts.get(key) || 0 }
  })

  const commentPosts = await BlogPost.find({ _id: { $in: recentComments.map((c) => c.post) } }).select("title").lean()
  const titleById = new Map(commentPosts.map((p) => [String(p._id), p.title]))

  return NextResponse.json({
    totals,
    recentPosts: recentPosts.map((p) => ({
      _id: String(p._id),
      title: p.title,
      slug: p.slug,
      status: p.status === "scheduled" && p.scheduledAt && new Date(p.scheduledAt) <= now ? "published" : p.status,
      updatedAt: new Date(p.updatedAt).toISOString(),
    })),
    recentComments: recentComments.map((c) => ({
      _id: String(c._id),
      userName: c.userName,
      body: c.body,
      status: c.status,
      postTitle: titleById.get(String(c.post)) || "",
      createdAt: new Date(c.createdAt).toISOString(),
    })),
    mostLiked: mostLiked.map((p) => ({ _id: String(p._id), title: p.title, slug: p.slug, count: p.likeCount })),
    mostCommented: mostCommented.map((p) => ({ _id: String(p._id), title: p.title, slug: p.slug, count: p.commentCount })),
    publishedOverTime,
    engagement,
  })
})
