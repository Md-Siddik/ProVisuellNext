import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"

export const GET = withApiErrors(async (request) => {
  const { user, access } = await authenticate(request)
  return NextResponse.json({
    user,
    access: { role: access.role, isSuperAdmin: access.isSuperAdmin, permissions: access.permissions },
  })
})
