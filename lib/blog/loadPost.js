import { cache } from "react"
import { getPublicPostBySlug } from "./queries"

// One database lookup per request, shared by the layout (which decides
// 404 / redirect before anything streams), generateMetadata and the page.
export const loadPost = cache((slug) => getPublicPostBySlug(slug))
