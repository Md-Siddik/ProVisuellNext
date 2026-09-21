import mongoose from "mongoose"
import { ApiError } from "@/lib/auth"
import { BlogPost } from "@/lib/models/BlogPost"
import { BlogCategory } from "@/lib/models/BlogCategory"
import { BlogTag } from "@/lib/models/BlogTag"
import { BlogComment } from "@/lib/models/BlogComment"
import { BlogSettings } from "@/lib/models/BlogSettings"
import { htmlToText, sanitizeArticleHtml } from "./sanitize"
import { isSafeMediaUrl, makeExcerpt, readingTimeMinutes, slugify } from "./utils"

// Write side of the blog: validation and normalisation of everything an
// admin can submit. Routes call these instead of trusting the request body.

const STATUSES = ["draft", "published", "scheduled", "archived"]
const MAX_CONTENT_CHARS = 300_000
const MAX_TAGS = 15

export function assertObjectId(id, message = "Not found") {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, message)
}

function text(value, max, label) {
  if (typeof value !== "string") throw new ApiError(400, `${label} must be text`)
  const trimmed = value.trim()
  if (trimmed.length > max) throw new ApiError(400, `${label} is too long`)
  return trimmed
}

export async function uniqueSlug(base, excludeId = null) {
  const root = slugify(base) || "post"
  let candidate = root
  for (let i = 2; i < 200; i++) {
    const clash = await BlogPost.exists({ slug: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })
    if (!clash) return candidate
    candidate = `${root}-${i}`
  }
  return `${root}-${Date.now()}`
}

// Creates any tag that does not exist yet and returns the slugs. Names that
// differ only by case or spacing collapse into one tag.
export async function ensureTags(names) {
  if (!Array.isArray(names)) throw new ApiError(400, "tags must be a list")
  const bySlug = new Map()
  for (const raw of names) {
    const name = text(String(raw ?? ""), 40, "Tag")
    const slug = slugify(name)
    if (slug && !bySlug.has(slug)) bySlug.set(slug, name)
  }
  if (bySlug.size > MAX_TAGS) throw new ApiError(400, `A post can have at most ${MAX_TAGS} tags`)
  for (const [slug, name] of bySlug) {
    await BlogTag.updateOne({ slug }, { $setOnInsert: { slug, name } }, { upsert: true })
  }
  return [...bySlug.keys()]
}

// Turns a request body into fields safe to store. `existing` is the current
// document when editing (only the keys present in `body` are touched).
export async function buildPostFields(body, existing = null) {
  const b = body && typeof body === "object" ? body : {}
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k)
  const fields = {}

  if (!existing || has("title")) {
    const title = text(b.title ?? "", 200, "Title")
    if (!title) throw new ApiError(400, "Title is required")
    fields.title = title
  }

  if (has("content") || !existing) {
    const raw = typeof b.content === "string" ? b.content : ""
    if (raw.length > MAX_CONTENT_CHARS) throw new ApiError(400, "Content is too long")
    fields.content = sanitizeArticleHtml(raw)
    fields.plainText = htmlToText(fields.content)
    fields.readingTime = readingTimeMinutes(fields.plainText)
  }

  if (has("excerpt")) fields.excerpt = text(b.excerpt ?? "", 400, "Excerpt")
  const plain = fields.plainText ?? existing?.plainText ?? ""
  if ((fields.excerpt ?? existing?.excerpt ?? "") === "" && plain) fields.excerpt = makeExcerpt(plain)

  for (const key of ["coverImage", "featuredVideo"]) {
    if (has(key)) {
      const url = b[key] ? String(b[key]).trim() : ""
      if (url && !isSafeMediaUrl(url)) throw new ApiError(400, "Invalid media URL")
      fields[key] = url
    }
  }
  if (has("coverImageAlt")) fields.coverImageAlt = text(b.coverImageAlt ?? "", 200, "Image description")
  if (has("seoTitle")) fields.seoTitle = text(b.seoTitle ?? "", 120, "SEO title")
  if (has("seoDescription")) fields.seoDescription = text(b.seoDescription ?? "", 300, "SEO description")
  if (has("featured")) fields.featured = Boolean(b.featured)

  if (has("category")) {
    if (!b.category) {
      fields.category = null
    } else {
      if (!mongoose.isValidObjectId(b.category) || !(await BlogCategory.exists({ _id: b.category }))) {
        throw new ApiError(400, "Category not found")
      }
      fields.category = b.category
    }
  }
  if (has("tags")) fields.tags = await ensureTags(b.tags)

  // Slug: explicit if given, otherwise derived from the title on create.
  const wantsSlug = has("slug") && String(b.slug || "").trim() !== ""
  if (wantsSlug || !existing) {
    const requested = slugify(wantsSlug ? b.slug : fields.title)
    if (!requested) throw new ApiError(400, "Slug is required")
    if (wantsSlug) {
      const clash = await BlogPost.exists({ slug: requested, ...(existing ? { _id: { $ne: existing._id } } : {}) })
      if (clash) throw new ApiError(409, "Slug already in use")
      fields.slug = requested
    } else {
      fields.slug = await uniqueSlug(requested)
    }
  }

  // Status and dates.
  const now = new Date()
  let status = has("status") ? b.status : existing?.status || "draft"
  if (!STATUSES.includes(status)) throw new ApiError(400, "Invalid status")
  let scheduledAt = has("scheduledAt") ? b.scheduledAt : existing?.scheduledAt
  if (status === "scheduled") {
    const when = new Date(scheduledAt)
    if (!scheduledAt || Number.isNaN(when.getTime())) throw new ApiError(400, "A scheduled post needs a valid date")
    if (when <= now) status = "published" // date already passed: it is simply live
    else {
      fields.scheduledAt = when
      fields.publishedAt = when
    }
  }
  if (status === "published") {
    const keep = existing?.publishedAt && existing.status !== "scheduled" && new Date(existing.publishedAt) <= now
    fields.publishedAt = keep ? existing.publishedAt : now
    fields.scheduledAt = null
  }
  if (status === "draft" || status === "archived") fields.scheduledAt = null
  fields.status = status

  return fields
}

export async function recountComments(postId) {
  const count = await BlogComment.countDocuments({ post: postId, status: "approved" })
  await BlogPost.updateOne({ _id: postId }, { commentCount: count })
  return count
}

export async function getSettings() {
  const doc = await BlogSettings.findOneAndUpdate({ key: "main" }, { $setOnInsert: { key: "main" } }, { upsert: true, new: true }).lean()
  return { requireCommentApproval: Boolean(doc.requireCommentApproval) }
}
