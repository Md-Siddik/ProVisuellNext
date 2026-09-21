import { NextResponse } from "next/server"
import { withApiErrors } from "@/lib/auth"
import { SiteContent } from "@/lib/models/SiteContent"
import { connectDB } from "@/lib/db"

// Public read — every visitor's page load merges this over the static
// translation defaults. No auth required.
export const GET = withApiErrors(async (request) => {
  await connectDB()
  const lang = new URL(request.url).searchParams.get("lang") || "no"
  const docs = await SiteContent.find({ $or: [{ language: lang }, { language: null }] })
  const content = {}
  for (const doc of docs) content[doc.contentKey] = doc.value
  return NextResponse.json({ content })
})
