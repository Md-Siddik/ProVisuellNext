import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { CmsItem } from "@/lib/models/CmsItem"
import { assertValidCollection } from "@/lib/cmsHelpers"

// Admin read — every item (published + hidden) with raw per-language data,
// used by the Website Editor so every language tab can be edited.
export const GET = withApiErrors(async (request, { params }) => {
  const { collection } = await params
  assertValidCollection(collection)
  requirePermission(await authenticate(request), "cms.view")

  const items = await CmsItem.find({ collectionKey: collection }).sort({ order: 1 })
  return NextResponse.json({ items })
})
