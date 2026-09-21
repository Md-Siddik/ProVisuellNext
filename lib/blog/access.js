import { authenticate, requireRole } from "@/lib/auth"

// Blog administration is limited to the roles that already run the dashboard.
export const BLOG_ADMIN_ROLES = ["owner", "administrator"]

export function isBlogAdmin(user) {
  return Boolean(user && BLOG_ADMIN_ROLES.includes(user.role))
}

// Full server-side check for every management route.
export async function requireBlogAdmin(request) {
  const auth = await authenticate(request)
  requireRole(auth.user, BLOG_ADMIN_ROLES)
  return auth
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
