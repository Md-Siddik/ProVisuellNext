import { NextResponse } from "next/server"
import { withApiErrors } from "@/lib/auth"
import { SiteContent } from "@/lib/models/SiteContent"
import { connectDB } from "@/lib/db"
import { resolveSiteContent, siteContentQuery } from "@/lib/siteContent"

// Public read — every visitor's page load merges this over the static
// translation defaults. No auth required. Shared values (contact details,
// copyright year, …) come from one row every language reads; see
// lib/siteContent.js.
export const GET = withApiErrors(async (request) => {
  await connectDB()
  const lang = new URL(request.url).searchParams.get("lang") || "no"
  const docs = await SiteContent.find(siteContentQuery(lang)).lean()
  return NextResponse.json({ content: resolveSiteContent(docs, lang) })
})
