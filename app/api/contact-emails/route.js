import { NextResponse } from "next/server"
import { authenticate, requireRole, withApiErrors } from "@/lib/auth"
import { ContactEmail } from "@/lib/models/ContactEmail"

export const GET = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  requireRole(user, ["administrator", "owner"])
  const emails = await ContactEmail.find().sort({ createdAt: -1 }).limit(200).lean()
  return NextResponse.json({ emails })
})
