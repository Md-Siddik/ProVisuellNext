import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"
import { requireSuperAdmin } from "@/lib/access"
import { User } from "@/lib/models/User"
import { ROLES } from "@/lib/permissions"
import { getRolePermissionConfig } from "@/lib/rolePermissions"
import { serializeManagedUser } from "@/lib/superadmin"

const PAGE_SIZE = 25

// Super Admin only: search and list users for role and account management.
//   ?search= &role=owner|administrator|moderator|customer &status=active|banned &page=
export const GET = withApiErrors(async (request) => {
  requireSuperAdmin(await authenticate(request))
  const sp = new URL(request.url).searchParams
  const search = (sp.get("search") || "").trim().slice(0, 100)
  const role = sp.get("role") || ""
  const status = sp.get("status") || ""
  const page = Math.max(1, Math.min(1000, Number(sp.get("page")) || 1))

  const query = {}
  if (ROLES.includes(role)) query.role = role
  // Users from before account status existed have no field — they're active.
  if (status === "banned") query.status = "banned"
  if (status === "active") query.status = { $ne: "banned" }
  if (search) {
    const safe = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
    query.$or = [{ name: safe }, { email: safe }]
  }
  const [users, total, roleConfig] = await Promise.all([
    User.find(query).sort({ role: 1, name: 1, email: 1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE),
    User.countDocuments(query),
    getRolePermissionConfig(),
  ])
  return NextResponse.json({
    users: await Promise.all(users.map((u) => serializeManagedUser(u, roleConfig))),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  })
})
