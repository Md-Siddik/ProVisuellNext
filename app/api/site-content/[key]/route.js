import { NextResponse } from "next/server"
import { authenticate, withApiErrors, ApiError } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { SiteContent } from "@/lib/models/SiteContent"
import { isSharedContentKey } from "@/lib/siteContent"

// Writes content — "cms.edit" only.
//   translatable text   saved for the given language only
//   shared text         saved once (language: null) for every language; any
//                       older per-language copies of it are removed, so no
//                       language can keep showing a stale value
//   images / video      saved once, as before
export const PUT = withApiErrors(async (request, { params }) => {
  const { key } = await params
  const { user } = requirePermission(await authenticate(request), "cms.edit")

  const { value, language, type } = (await request.json().catch(() => ({}))) || {}
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(400, "value is required")
  }
  const resolvedType = type === "image" || type === "video" ? type : "text"
  const shared = resolvedType === "text" && isSharedContentKey(key)
  const resolvedLanguage = resolvedType === "text" && !shared ? language || "no" : null

  const doc = await SiteContent.findOneAndUpdate(
    { contentKey: key, language: resolvedLanguage },
    { contentKey: key, language: resolvedLanguage, type: resolvedType, value, updatedBy: user._id },
    { upsert: true, new: true }
  )
  if (shared) await SiteContent.deleteMany({ contentKey: key, language: { $ne: null } })
  return NextResponse.json({ content: doc, shared })
})

// Removes an edit (back to the built-in default). For a shared key that's
// every language's copy.
export const DELETE = withApiErrors(async (request, { params }) => {
  const { key } = await params
  requirePermission(await authenticate(request), "cms.edit")

  if (isSharedContentKey(key)) {
    await SiteContent.deleteMany({ contentKey: key })
  } else {
    const language = new URL(request.url).searchParams.get("language") || null
    await SiteContent.deleteOne({ contentKey: key, language })
  }
  return new Response(null, { status: 204 })
})
