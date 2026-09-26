import { NextResponse } from "next/server"
import { ApiError, withApiErrors } from "@/lib/auth"
import { requireBlogAdmin } from "@/lib/blog/access"
import { toInt } from "@/lib/blog/utils"
import { saveUploadedFile } from "@/lib/uploadStorage"
import { BlogMedia } from "@/lib/models/BlogMedia"

// Same storage adapter every other upload uses (lib/uploadStorage.js).
// SVG is deliberately not accepted: it can carry scripts.
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"]
const MAX_IMAGE = 10 * 1024 * 1024
const MAX_VIDEO = 80 * 1024 * 1024

export const GET = withApiErrors(async (request) => {
  await requireBlogAdmin(request, "blog.view")
  const sp = new URL(request.url).searchParams
  const page = toInt(sp.get("page"), 1, { max: 1000 })
  const limit = toInt(sp.get("limit"), 24, { max: 60 })
  const type = ["image", "video"].includes(sp.get("type")) ? { type: sp.get("type") } : {}
  const [total, media] = await Promise.all([
    BlogMedia.countDocuments(type),
    BlogMedia.find(type)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ])
  return NextResponse.json({ media, total, page, pages: Math.max(1, Math.ceil(total / limit)) })
})

export const POST = withApiErrors(async (request) => {
  const { user } = await requireBlogAdmin(request, "blog.create", "blog.edit")
  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!file || typeof file.arrayBuffer !== "function") throw new ApiError(400, "No file uploaded")

  const isImage = IMAGE_TYPES.includes(file.type)
  const isVideo = VIDEO_TYPES.includes(file.type)
  if (!isImage && !isVideo) throw new ApiError(400, "Unsupported file type")
  if (file.size > (isImage ? MAX_IMAGE : MAX_VIDEO)) {
    throw new ApiError(400, isImage ? "Image exceeds the 10MB limit" : "Video exceeds the 80MB limit")
  }

  const saved = await saveUploadedFile(file, "blog_")
  const media = await BlogMedia.create({
    url: saved.url,
    type: isImage ? "image" : "video",
    fileName: saved.fileName,
    size: saved.size,
    mimeType: file.type,
    uploadedBy: user._id,
  })
  return NextResponse.json({ media }, { status: 201 })
})
