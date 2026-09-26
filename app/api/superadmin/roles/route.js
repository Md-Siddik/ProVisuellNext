import { NextResponse } from "next/server"
import { ApiError, authenticate, withApiErrors } from "@/lib/auth"
import { requireSuperAdmin } from "@/lib/access"
import { resetRolePermissions, roleMatrix, saveRolePermissions } from "@/lib/superadmin"

// Super Admin only: the permission set of each staff role. Users of a role
// get its set (plus their own overrides) on their very next request.

export const GET = withApiErrors(async (request) => {
  requireSuperAdmin(await authenticate(request))
  return NextResponse.json(await roleMatrix())
})

// { role, permissions: [keys] }   — replace the role's set
// { role, reset: true }           — back to the built-in defaults
export const PUT = withApiErrors(async (request) => {
  const { user: actor } = requireSuperAdmin(await authenticate(request))
  const body = (await request.json().catch(() => ({}))) || {}
  if (typeof body.role !== "string") throw new ApiError(400, "Invalid role")
  const matrix = body.reset === true ? await resetRolePermissions(actor, body.role) : await saveRolePermissions(actor, body.role, body.permissions)
  return NextResponse.json({ ...matrix, message: "Permissions saved" })
})

export const dynamic = "force-dynamic"
