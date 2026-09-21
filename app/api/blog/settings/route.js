import { NextResponse } from "next/server"
import { withApiErrors } from "@/lib/auth"
import { requireBlogAdmin } from "@/lib/blog/access"
import { getSettings } from "@/lib/blog/mutations"
import { BlogSettings } from "@/lib/models/BlogSettings"

export const GET = withApiErrors(async (request) => {
  await requireBlogAdmin(request)
  return NextResponse.json({ settings: await getSettings() })
})

export const PATCH = withApiErrors(async (request) => {
  await requireBlogAdmin(request)
  const body = (await request.json().catch(() => ({}))) || {}
  if (body.requireCommentApproval !== undefined) {
    await BlogSettings.updateOne({ key: "main" }, { requireCommentApproval: Boolean(body.requireCommentApproval) }, { upsert: true })
  }
  return NextResponse.json({ settings: await getSettings() })
})
