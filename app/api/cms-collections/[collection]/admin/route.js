import { NextResponse } from "next/server"
import { authenticate, requireRole, withApiErrors } from "@/lib/auth"
import { CmsItem } from "@/lib/models/CmsItem"
import { assertValidCollection } from "@/lib/cmsHelpers"

// Admin read — every item (published + hidden) with raw per-language data,
// used by the Website Editor so every language tab can be edited.
export const GET = withApiErrors(async (request, { params }) => {
  const { collection } = await params
  assertValidCollection(collection)
  const { user } = await authenticate(request)
  requireRole(user, ["administrator"])

  const items = await CmsItem.find({ collectionKey: collection }).sort({ order: 1 })
  return NextResponse.json({ items })
})
