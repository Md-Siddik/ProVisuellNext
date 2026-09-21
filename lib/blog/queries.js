import { connectDB } from "@/lib/db"
import { BlogPost } from "@/lib/models/BlogPost"
import { BlogCategory } from "@/lib/models/BlogCategory"
import { BlogTag } from "@/lib/models/BlogTag"
import { effectiveStatus, publicPostFilter } from "./access"
import { sanitizeArticleHtml } from "./sanitize"
import { escapeRegex, idToString, slugify } from "./utils"

// Read side of the blog: everything the public pages and the public API
// return. Every query is built on publicPostFilter, so a draft, an archived
// post or a not-yet-due scheduled post can never come out of here.

export function getSiteUrl() {
  return (process.env.CLIENT_URL || process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "")
}

// Bulk-loads the categories a batch of posts refers to (one query, no N+1).
async function categoryMapFor(posts) {
  const ids = [...new Set(posts.map((p) => idToString(p.category)).filter(Boolean))]
  if (ids.length === 0) return new Map()
  const categories = await BlogCategory.find({ _id: { $in: ids } }).select("name slug").lean()
  return new Map(categories.map((c) => [String(c._id), { _id: String(c._id), name: c.name, slug: c.slug }]))
}

// Plain, JSON-safe shape (ObjectIds and Dates as strings) so the same object
// can be returned from an API route or handed to a Client Component.
export function serializePost(p, categories, { withContent = false } = {}) {
  const out = {
    _id: String(p._id),
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt || "",
    coverImage: p.coverImage || "",
    coverImageAlt: p.coverImageAlt || "",
    hasVideo: Boolean(p.featuredVideo),
    category: categories.get(idToString(p.category)) || null,
    tags: p.tags || [],
    author: { name: p.author?.name || "", avatar: p.author?.avatar || "" },
    status: effectiveStatus(p),
    featured: Boolean(p.featured),
    publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString() : null,
    updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : null,
    readingTime: p.readingTime || 1,
    likeCount: p.likeCount || 0,
    commentCount: p.commentCount || 0,
  }
  if (withContent) {
    out.content = sanitizeArticleHtml(p.content)
    out.featuredVideo = p.featuredVideo || ""
    out.seoTitle = p.seoTitle || ""
    out.seoDescription = p.seoDescription || ""
  }
  return out
}

async function serializeMany(docs) {
  const categories = await categoryMapFor(docs)
  return docs.map((d) => serializePost(d, categories))
}

const LIST_SELECT = "-content -plainText -previousSlugs"

export async function listPublicPosts({ q = "", category = "", tag = "", page = 1, limit = 9, excludeId = null } = {}) {
  await connectDB()
  const empty = { posts: [], total: 0, page, pages: 1 }
  const and = [publicPostFilter()]
  if (excludeId) and.push({ _id: { $ne: excludeId } })

  if (category) {
    const cat = await BlogCategory.findOne({ slug: String(category).toLowerCase() }).select("_id").lean()
    if (!cat) return empty
    and.push({ category: cat._id })
  }
  if (tag) and.push({ tags: slugify(tag) })
  if (q && q.trim()) {
    const rx = new RegExp(escapeRegex(q.trim().slice(0, 80)), "i")
    const matchingCategories = await BlogCategory.find({ name: rx }).select("_id").lean()
    and.push({
      $or: [
        { title: rx },
        { excerpt: rx },
        { plainText: rx },
        { tags: rx },
        ...(matchingCategories.length ? [{ category: { $in: matchingCategories.map((c) => c._id) } }] : []),
      ],
    })
  }

  const filter = { $and: and }
  const [total, docs] = await Promise.all([
    BlogPost.countDocuments(filter),
    BlogPost.find(filter)
      .select(LIST_SELECT)
      .sort({ publishedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ])
  return { posts: await serializeMany(docs), total, page, pages: Math.max(1, Math.ceil(total / limit)) }
}

// The newest featured post; if nothing is featured, simply the newest post.
export async function getFeaturedPost() {
  await connectDB()
  const base = publicPostFilter()
  let doc = await BlogPost.findOne({ $and: [base, { featured: true }] })
    .select(LIST_SELECT)
    .sort({ publishedAt: -1 })
    .lean()
  if (!doc) doc = await BlogPost.findOne(base).select(LIST_SELECT).sort({ publishedAt: -1 }).lean()
  if (!doc) return null
  return (await serializeMany([doc]))[0]
}

// Returns { post } for a live article, { redirectTo } when the slug is an
// old one that was renamed, or {} when there is nothing public at that slug.
export async function getPublicPostBySlug(slug) {
  await connectDB()
  const base = publicPostFilter()
  const clean = String(slug || "").toLowerCase()
  const doc = await BlogPost.findOne({ $and: [base, { slug: clean }] }).lean()
  if (doc) {
    const categories = await categoryMapFor([doc])
    return { post: serializePost(doc, categories, { withContent: true }), raw: doc }
  }
  const renamed = await BlogPost.findOne({ $and: [base, { previousSlugs: clean }] }).select("slug").lean()
  return renamed ? { redirectTo: renamed.slug } : {}
}

export async function getRelatedPosts(post, limit = 3) {
  await connectDB()
  const or = []
  if (post.category?._id) or.push({ category: post.category._id })
  if (post.tags?.length) or.push({ tags: { $in: post.tags } })
  const base = publicPostFilter()
  const selfExcluded = { _id: { $ne: post._id } }

  let docs = or.length
    ? await BlogPost.find({ $and: [base, selfExcluded, { $or: or }] })
        .select(LIST_SELECT)
        .sort({ publishedAt: -1 })
        .limit(12)
        .lean()
    : []

  // Rank: shared tags count most, then same category, then recency (already sorted).
  const score = (d) =>
    (d.tags || []).filter((t) => post.tags?.includes(t)).length * 2 + (idToString(d.category) === post.category?._id ? 1 : 0)
  docs = docs.sort((a, b) => score(b) - score(a)).slice(0, limit)

  if (docs.length < limit) {
    const have = [String(post._id), ...docs.map((d) => String(d._id))]
    const recent = await BlogPost.find({ $and: [base, { _id: { $nin: have } }] })
      .select(LIST_SELECT)
      .sort({ publishedAt: -1 })
      .limit(limit - docs.length)
      .lean()
    docs = [...docs, ...recent]
  }
  return serializeMany(docs)
}

// Older = "previous", newer = "next".
export async function getNeighbors(post) {
  await connectDB()
  const base = publicPostFilter()
  const at = new Date(post.publishedAt)
  const [older, newer] = await Promise.all([
    BlogPost.findOne({ $and: [base, { publishedAt: { $lt: at } }] }).select("title slug coverImage").sort({ publishedAt: -1 }).lean(),
    BlogPost.findOne({ $and: [base, { publishedAt: { $gt: at } }] }).select("title slug coverImage").sort({ publishedAt: 1 }).lean(),
  ])
  const pick = (d) => (d ? { title: d.title, slug: d.slug, coverImage: d.coverImage || "" } : null)
  return { previous: pick(older), next: pick(newer) }
}

// Categories that have at least one live post, with how many.
export async function getPublicCategories() {
  await connectDB()
  const counts = await BlogPost.aggregate([
    { $match: { $and: [publicPostFilter(), { category: { $ne: null } }] } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ])
  if (counts.length === 0) return []
  const categories = await BlogCategory.find({ _id: { $in: counts.map((c) => c._id) } }).select("name slug description").lean()
  const countById = new Map(counts.map((c) => [String(c._id), c.count]))
  return categories
    .map((c) => ({ _id: String(c._id), name: c.name, slug: c.slug, description: c.description || "", count: countById.get(String(c._id)) || 0 }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function getPublicTags(limit = 12) {
  await connectDB()
  const counts = await BlogPost.aggregate([
    { $match: publicPostFilter() },
    { $unwind: "$tags" },
    { $group: { _id: "$tags", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: limit },
  ])
  if (counts.length === 0) return []
  const tags = await BlogTag.find({ slug: { $in: counts.map((c) => c._id) } }).select("name slug").lean()
  const nameBySlug = new Map(tags.map((t) => [t.slug, t.name]))
  return counts.map((c) => ({ slug: c._id, name: nameBySlug.get(c._id) || c._id, count: c.count }))
}

// A live post by ObjectId or slug (API callers may use either), lean doc.
export async function findPublicPost(idOrSlug) {
  await connectDB()
  const key = String(idOrSlug || "")
  const match = /^[a-f0-9]{24}$/i.test(key) ? { _id: key } : { slug: key.toLowerCase() }
  return BlogPost.findOne({ $and: [publicPostFilter(), match] }).lean()
}

export { categoryMapFor }
