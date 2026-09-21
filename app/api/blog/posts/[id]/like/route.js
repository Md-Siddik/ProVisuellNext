import { NextResponse } from "next/server"
import { ApiError, authenticate, withApiErrors } from "@/lib/auth"
import { optionalAuth } from "@/lib/blog/access"
import { findPublicPost } from "@/lib/blog/queries"
import { BlogLike } from "@/lib/models/BlogLike"
import { BlogPost } from "@/lib/models/BlogPost"

// The counter is recomputed from the likes collection rather than nudged
// with $inc, so it can never drift even if two requests race.
async function syncCount(postId) {
  const likeCount = await BlogLike.countDocuments({ post: postId })
  await BlogPost.updateOne({ _id: postId }, { likeCount })
  return likeCount
}

// Public: how many likes, and (for a signed-in visitor) whether they liked.
export const GET = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const post = await findPublicPost(id)
  if (!post) throw new ApiError(404, "Not found")
  const auth = await optionalAuth(request)
  const liked = auth ? Boolean(await BlogLike.exists({ post: post._id, user: auth.user._id })) : false
  return NextResponse.json({ liked, likeCount: post.likeCount || 0 })
})

// Login required (verified server-side). Idempotent: liking twice is a no-op.
export const POST = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const { user } = await authenticate(request)
  const post = await findPublicPost(id)
  if (!post) throw new ApiError(404, "Not found")
  try {
    await BlogLike.create({ post: post._id, user: user._id })
  } catch (err) {
    if (err?.code !== 11000) throw err // 11000 = already liked
  }
  return NextResponse.json({ liked: true, likeCount: await syncCount(post._id) })
})

export const DELETE = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const { user } = await authenticate(request)
  const post = await findPublicPost(id)
  if (!post) throw new ApiError(404, "Not found")
  await BlogLike.deleteOne({ post: post._id, user: user._id })
  return NextResponse.json({ liked: false, likeCount: await syncCount(post._id) })
})
