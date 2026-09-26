import { authenticate, withApiErrors, ApiError } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { CmsItem } from "@/lib/models/CmsItem"
import { assertValidCollection } from "@/lib/cmsHelpers"

// Reorder — body is the full list of item ids in their new display order.
export const POST = withApiErrors(async (request, { params }) => {
  const { collection } = await params
  assertValidCollection(collection)
  requirePermission(await authenticate(request), "cms.edit")

  const { ids } = (await request.json().catch(() => ({}))) || {}
  if (!Array.isArray(ids) || !ids.length) throw new ApiError(400, "ids array required")
  await Promise.all(
    ids.map((id, index) => CmsItem.updateOne({ _id: id, collectionKey: collection }, { order: index }))
  )
  return new Response(null, { status: 204 })
})
