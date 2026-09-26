import { authenticate } from "@/lib/auth"
import { ApiError } from "@/lib/apiError"
import { can, requireAnyPermission } from "@/lib/access"

// Blog administration is permission-based (lib/permissions.js "blog.*").

// Whether a signed-in viewer (or null) may see unpublished posts.
export function isBlogAdmin(auth) {
  return can(auth, "blog.view")
}

// Whether they moderate comments (change status, delete others', skip approval).
export function isCommentModerator(auth) {
  return can(auth, "blog.moderateComments")
}

// Full server-side check for every management route: signed in and holding
// at least one of the given permissions.
export async function requireBlogAdmin(request, ...permissions) {
  const auth = await authenticate(request)
  requireAnyPermission(auth, ...(permissions.length ? permissions : ["blog.view"]))
  return auth
}

const LIVE = ["published", "scheduled"]

// Putting a post live, taking a live post down, or editing one that's live
// all change what the public sees — that takes blog.publish.
export function assertCanPublish(auth, nextStatus, previousStatus = null) {
  const touchesLive = LIVE.includes(nextStatus) || (previousStatus && LIVE.includes(previousStatus))
  if (touchesLive && !can(auth, "blog.publish")) throw new ApiError(403, "Not allowed for your role")
}

// For public routes that show a bit more to a signed-in visitor (their own
// like, their own pending comment). A missing or bad token just means an
// anonymous visitor — it never turns a public read into an error.
export async function optionalAuth(request) {
  if (!request.headers.get("authorization")) return null
  try {
    return await authenticate(request)
  } catch {
    return null
  }
}

// What the public may see: published posts, plus scheduled posts whose time
// has come. Drafts and archived posts never match.
export function publicPostFilter(now = new Date()) {
  return { $or: [{ status: "published" }, { status: "scheduled", scheduledAt: { $lte: now } }] }
}

// A scheduled post whose date has passed is live — report it as published.
export function effectiveStatus(post, now = new Date()) {
  if (post.status === "scheduled" && post.scheduledAt && new Date(post.scheduledAt) <= now) return "published"
  return post.status
}

// Display name/avatar for content the server attributes to the signed-in
// user — never read from the request body.
export function identityOf({ user, firebaseUser }) {
  const local = (user.email || "").split("@")[0]
  return {
    name: user.name || firebaseUser?.name || local || "User",
    avatar: firebaseUser?.picture || "",
  }
}
