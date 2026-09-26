import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { ContactEmail } from "@/lib/models/ContactEmail"

export const GET = withApiErrors(async (request) => {
  requirePermission(await authenticate(request), "messages.viewEmailInbox")
  const emails = await ContactEmail.find().sort({ createdAt: -1 }).limit(200).lean()
  return NextResponse.json({ emails })
})
