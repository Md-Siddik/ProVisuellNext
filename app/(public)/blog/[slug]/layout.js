import { notFound, permanentRedirect } from "next/navigation"
import { loadPost } from "@/lib/blog/loadPost"

// Runs before the page's loading skeleton starts streaming, which is what lets
// a missing/draft article answer with a real 404 (and a renamed article's old
// URL with a real 308) instead of a 200 that only looks like an error.
export default async function ArticleLayout({ children, params }) {
  const { slug } = await params
  const { post, redirectTo } = await loadPost(slug)
  if (redirectTo) permanentRedirect(`/blog/${redirectTo}`)
  if (!post) notFound()
  return children
}
