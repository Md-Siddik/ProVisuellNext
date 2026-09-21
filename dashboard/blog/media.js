import { api } from "@/lib/api"

// Same limits the API enforces — checked here first for instant feedback.
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"]
export const MAX_IMAGE_MB = 10
export const MAX_VIDEO_MB = 80

// Returns an i18n key (with vars) describing the problem, or null if the file is fine.
export function checkMediaFile(file, kind) {
  if (!file) return { key: "blogAdmin.media.noFile" }
  const types = kind === "video" ? VIDEO_TYPES : kind === "any" ? [...IMAGE_TYPES, ...VIDEO_TYPES] : IMAGE_TYPES
  if (!types.includes(file.type)) return { key: "blogAdmin.media.badType" }
  const isVideo = VIDEO_TYPES.includes(file.type)
  const max = (isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB) * 1024 * 1024
  if (file.size > max) return { key: "blogAdmin.media.tooLarge", vars: { mb: isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB } }
  return null
}

// Uploads through the blog media endpoint (which uses the shared storage
// adapter) and returns the stored file's record.
export async function uploadBlogMedia(file) {
  const form = new FormData()
  form.append("file", file)
  const { media } = await api.postForm("/blog/media", form)
  return media
}
