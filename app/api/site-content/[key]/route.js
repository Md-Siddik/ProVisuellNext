import { NextResponse } from "next/server"
import { authenticate, requireRole, withApiErrors, ApiError } from "@/lib/auth"
import { SiteContent } from "@/lib/models/SiteContent"

// Writes content — administrator only.
export const PUT = withApiErrors(async (request, { params }) => {
  const { key } = await params
  const { user } = await authenticate(request)
  requireRole(user, ["administrator"])

  const { value, language, type } = (await request.json().catch(() => ({}))) || {}
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(400, "value is required")
  }
  const resolvedType = type === "image" || type === "video" ? type : "text"
  const resolvedLanguage = resolvedType === "text" ? language || "no" : null

  const doc = await SiteContent.findOneAndUpdate(
    { contentKey: key, language: resolvedLanguage },
    { contentKey: key, language: resolvedLanguage, type: resolvedType, value, updatedBy: user._id },
    { upsert: true, new: true }
  )
  return NextResponse.json({ content: doc })
})

export const DELETE = withApiErrors(async (request, { params }) => {
  const { key } = await params
  const { user } = await authenticate(request)
  requireRole(user, ["administrator"])

  const language = new URL(request.url).searchParams.get("language") || null
  await SiteContent.deleteOne({ contentKey: key, language })
  return new Response(null, { status: 204 })
})
