import { NextResponse } from "next/server"
import { authenticate, withApiErrors, ApiError } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { CmsItem } from "@/lib/models/CmsItem"
import { assertValidCollection } from "@/lib/cmsHelpers"

export const PUT = withApiErrors(async (request, { params }) => {
  const { collection, id } = await params
  assertValidCollection(collection)
  const { user } = requirePermission(await authenticate(request), "cms.edit")

  const { language, fields, link, image, video, published } = (await request.json().catch(() => ({}))) || {}
  const item = await CmsItem.findOne({ _id: id, collectionKey: collection })
  if (!item) throw new ApiError(404, "Not found")

  if (language && fields) {
    for (const [fieldName, value] of Object.entries(fields)) {
      const current = { ...(item.translations.get(fieldName) || {}) }
      current[language] = value
      item.translations.set(fieldName, current)
    }
    item.markModified("translations")
  }
  if (link !== undefined) item.link = link
  if (image !== undefined) item.image = image
  if (video !== undefined) item.video = video
  if (published !== undefined) item.published = published
  item.updatedBy = user._id

  await item.save()
  return NextResponse.json({ item })
})

export const DELETE = withApiErrors(async (request, { params }) => {
  const { collection, id } = await params
  assertValidCollection(collection)
  requirePermission(await authenticate(request), "cms.edit")

  await CmsItem.deleteOne({ _id: id, collectionKey: collection })
  return new Response(null, { status: 204 })
})
