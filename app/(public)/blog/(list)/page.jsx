import BlogHome from "@/components/blog/BlogHome"
import { getFeaturedPost, getPublicCategories, getPublicTags, getSiteUrl, listPublicPosts } from "@/lib/blog/queries"
import { toInt } from "@/lib/blog/utils"

// Reads the database on every request; nothing here can be prerendered.
export const dynamic = "force-dynamic"

const PAGE_SIZE = 9

const one = (v) => (Array.isArray(v) ? v[0] : v) || ""

export async function generateMetadata({ searchParams }) {
  const sp = await searchParams
  const base = getSiteUrl()
  const filtered = Boolean(one(sp.q) || one(sp.category) || one(sp.tag) || one(sp.page))
  const title = "Blog | ProVisuell"
  const description = "News, tips and stories from ProVisuell on branding, design and visibility."
  return {
    ...(base ? { metadataBase: new URL(base) } : {}),
    title,
    description,
    alternates: { canonical: "/blog" },
    // Search results and deep pages are for people, not the index.
    robots: filtered ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: { type: "website", title, description, url: "/blog" },
    twitter: { card: "summary", title, description },
  }
}

export default async function BlogPage({ searchParams }) {
  const sp = await searchParams
  const q = one(sp.q).trim().slice(0, 80)
  const category = one(sp.category).slice(0, 90)
  const tag = one(sp.tag).slice(0, 90)
  const page = toInt(one(sp.page), 1, { max: 1000 })
  const filtered = Boolean(q || category || tag)

  const featuredAny = filtered ? null : await getFeaturedPost()
  const [list, categories, tags] = await Promise.all([
    // The featured post has its own slot, so the grid never repeats it.
    listPublicPosts({ q, category, tag, page, limit: PAGE_SIZE, excludeId: featuredAny?._id || null }),
    getPublicCategories(),
    getPublicTags(12),
  ])

  return (
    <BlogHome
      featured={page === 1 ? featuredAny : null}
      posts={list.posts}
      total={list.total}
      page={list.page}
      pages={list.pages}
      categories={categories}
      tags={tags}
      filters={{ q, category, tag }}
    />
  )
}
