import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { CmsItem } from "@/lib/models/CmsItem"
import { connectDB } from "@/lib/db"
import { assertValidCollection, resolveTranslations } from "@/lib/cmsHelpers"

// Public read — only published items, translations resolved to one
// language. No auth required; this is what the live marketing site loads.
export const GET = withApiErrors(async (request, { params }) => {
  const { collection } = await params
  assertValidCollection(collection)
  await connectDB()

  const lang = new URL(request.url).searchParams.get("lang") || "no"
  const items = await CmsItem.find({ collectionKey: collection, published: true }).sort({ order: 1 })
  return NextResponse.json({
    items: items.map((item) => ({
      _id: item._id,
      ...resolveTranslations(item.translations, lang),
      link: item.link,
      image: item.image,
      video: item.video,
      order: item.order,
    })),
  })
})

// Writes content — administrator only.
export const POST = withApiErrors(async (request, { params }) => {
  const { collection } = await params
  assertValidCollection(collection)
  const { user } = requirePermission(await authenticate(request), "cms.edit")

  const { language, fields, link, image, video, published } = (await request.json().catch(() => ({}))) || {}
  const translations = {}
  if (language && fields) {
    for (const [fieldName, value] of Object.entries(fields)) {
      translations[fieldName] = { [language]: value }
    }
  }
  const last = await CmsItem.findOne({ collectionKey: collection }).sort({ order: -1 })
  const item = await CmsItem.create({
    collectionKey: collection,
    translations,
    link: link || "",
    image: image || "",
    video: video || "",
    published: published !== undefined ? published : true,
    order: (last?.order ?? -1) + 1,
    updatedBy: user._id,
  })
  return NextResponse.json({ item }, { status: 201 })
})
