import { notFound, permanentRedirect } from "next/navigation"
import ArticleView from "@/components/blog/ArticleView"
import { loadPost } from "@/lib/blog/loadPost"
import { getNeighbors, getRelatedPosts, getSiteUrl } from "@/lib/blog/queries"

export const dynamic = "force-dynamic"

const absolute = (base, url) => (url && url.startsWith("/") && base ? `${base}${url}` : url)

export async function generateMetadata({ params }) {
  const { slug } = await params
  const { post } = await loadPost(slug)
  // Drafts, archived and unknown slugs get no article metadata and are not indexable.
  if (!post) return { title: "Blog | ProVisuell", robots: { index: false, follow: false } }

  const base = getSiteUrl()
  const title = post.seoTitle || post.title
  const description = post.seoDescription || post.excerpt || undefined
  const url = `/blog/${post.slug}`
  const image = absolute(base, post.coverImage)
  return {
    ...(base ? { metadataBase: new URL(base) } : {}),
    title: `${title} | ProVisuell`,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      publishedTime: post.publishedAt || undefined,
      modifiedTime: post.updatedAt || undefined,
      authors: post.author.name ? [post.author.name] : undefined,
      tags: post.tags.length ? post.tags : undefined,
      ...(image ? { images: [{ url: image, alt: post.coverImageAlt || post.title }] } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  }
}

export default async function ArticlePage({ params }) {
  const { slug } = await params
  const { post, redirectTo } = await loadPost(slug)
  // A renamed article's old URL keeps working.
  if (redirectTo) permanentRedirect(`/blog/${redirectTo}`)
  if (!post) notFound()

  const [related, neighbors] = await Promise.all([getRelatedPosts(post, 3), getNeighbors(post)])

  const base = getSiteUrl()
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.seoDescription || post.excerpt || undefined,
    image: post.coverImage ? [absolute(base, post.coverImage)] : undefined,
    datePublished: post.publishedAt || undefined,
    dateModified: post.updatedAt || undefined,
    author: post.author.name ? { "@type": "Person", name: post.author.name } : undefined,
    publisher: { "@type": "Organization", name: "ProVisuell" },
    mainEntityOfPage: base ? `${base}/blog/${post.slug}` : undefined,
    keywords: post.tags.length ? post.tags.join(", ") : undefined,
  }

  return (
    <>
      <script
        type="application/ld+json"
        // "<" is escaped so article text can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ArticleView post={post} related={related} neighbors={neighbors} />
    </>
  )
}
