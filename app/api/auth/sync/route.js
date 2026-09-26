import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"

// Called right after a successful Firebase login/signup. authenticate()
// already does the upsert; this just fills in name/phone the first time.
// `access` (effective role + permissions) is for UI visibility only — every
// API route re-checks permissions server-side.
export const POST = withApiErrors(async (request) => {
  const { name, phone } = (await request.json().catch(() => ({}))) || {}
  const { user, access } = await authenticate(request)
  if (name && !user.name) user.name = name
  if (phone && !user.phone) user.phone = phone
  await user.save()
  return NextResponse.json({ user, access: publicAccess(access) })
})

function publicAccess(access) {
  return { role: access.role, isSuperAdmin: access.isSuperAdmin, permissions: access.permissions }
}
