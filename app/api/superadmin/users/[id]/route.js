import { NextResponse } from "next/server"
import mongoose from "mongoose"
import { ApiError, authenticate, withApiErrors } from "@/lib/auth"
import { requireSuperAdmin } from "@/lib/access"
import { User } from "@/lib/models/User"
import { changeRole, deleteUser, resetPermissions, serializeManagedUser, setAccountStatus, setPermission } from "@/lib/superadmin"

// Super Admin only: one user's role, permission overrides and account status.
export const GET = withApiErrors(async (request, { params }) => {
  const { id } = await params
  requireSuperAdmin(await authenticate(request))
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "User not found")
  const user = await User.findById(id)
  if (!user) throw new ApiError(404, "User not found")
  return NextResponse.json({ user: await serializeManagedUser(user) })
})

// One change per request:
//   { role: "administrator" | "owner" | "moderator" | "customer" }
//   { permission: "orders.approve", state: "grant" | "deny" | "inherit" }
//   { reset: true }   — clear every override (back to role defaults)
//   { status: "banned", reason? } | { status: "active" }   — ban / unban
export const PATCH = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const { user: actor } = requireSuperAdmin(await authenticate(request))
  const body = (await request.json().catch(() => ({}))) || {}

  let target
  let message = ""
  if (body.reset === true) target = await resetPermissions(actor, id)
  else if (typeof body.status === "string") {
    target = await setAccountStatus(actor, id, body.status, body.reason)
    message = body.status === "banned" ? "User banned" : "User unbanned"
  } else if (typeof body.role === "string") target = await changeRole(actor, id, body.role)
  else if (typeof body.permission === "string") target = await setPermission(actor, id, body.permission, body.state)
  else throw new ApiError(400, "Nothing to change")

  return NextResponse.json({ user: await serializeManagedUser(target), ...(message ? { message } : {}) })
})

// Permanently deletes the account (see lib/superadmin.js deleteUser).
export const DELETE = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const { user: actor } = requireSuperAdmin(await authenticate(request))
  const deleted = await deleteUser(actor, id)
  return NextResponse.json({ deleted: { _id: deleted._id, email: deleted.email }, message: "User deleted" })
})
