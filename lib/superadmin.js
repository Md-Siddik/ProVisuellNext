import mongoose from "mongoose"
import { ApiError } from "./apiError.js"
import { isProtectedSuperAdmin, userPermissions } from "./access.js"
import { AuditLog } from "./models/AuditLog.js"
import { DeletedUser } from "./models/DeletedUser.js"
import { Notification } from "./models/Notification.js"
import { RolePermission } from "./models/RolePermission.js"
import { User } from "./models/User.js"
import { deleteNotesOfUser } from "./notes/service.js"
import { banIdentity, emailQuery, liftIdentityBan } from "./accountIdentity.js"
import { getRolePermissionConfig, invalidateRolePermissionCache } from "./rolePermissions.js"
import {
  ASSIGNABLE_ROLES,
  EDITABLE_ROLES,
  NON_GRANTABLE,
  PERMISSIONS,
  ROLE_LOCKED,
  explainPermission,
  isGrantable,
  isPermission,
  resolveRoleBase,
  roleDefaults,
  sanitizeRolePermissions,
} from "./permissions.js"

// User, role and permission management behind the Super Admin control
// center. Every caller has already passed requireSuperAdmin(); these
// functions still validate every input, since the request body is untrusted.

const ROLE_LABEL = { administrator: "ADMIN", owner: "OWNER", moderator: "MODERATOR", customer: "CUSTOMER" }
const BAN_REASON_MAX = 300

export async function serializeManagedUser(user, roleConfig = null) {
  const config = roleConfig || (await getRolePermissionConfig())
  const isSuperAdmin = await isProtectedSuperAdmin(user)
  const grants = user.permissionGrants || []
  const denies = user.permissionDenies || []
  const base = resolveRoleBase(user.role, config)
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isSuperAdmin,
    status: user.status === "banned" ? "banned" : "active",
    bannedAt: user.bannedAt || null,
    banReason: user.banReason || "",
    createdAt: user.createdAt,
    grants,
    denies,
    effectivePermissions: isSuperAdmin ? PERMISSIONS : userPermissions(user, config),
    permissions: PERMISSIONS.map((key) => ({ key, ...explainPermission({ role: user.role, grants, denies, base }, key) })),
  }
}

// The user an action targets. Nobody — the Super Admin included — changes
// the Super Admin through the app, and nobody acts on their own account here.
async function loadTarget(actor, id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "User not found")
  const target = await User.findById(id)
  if (!target) throw new ApiError(404, "User not found")
  if (await isProtectedSuperAdmin(target)) throw new ApiError(403, "The Super Admin account can't be modified")
  if (String(target._id) === String(actor._id)) throw new ApiError(403, "You can't change your own account here")
  return target
}

function audit(actor, target, entry) {
  return AuditLog.create({
    actor: actor._id,
    actorEmail: actor.email,
    target: target?._id || null,
    targetEmail: target?.email || "",
    targetName: target?.name || "",
    ...entry,
  })
}

export async function changeRole(actor, id, role) {
  if (!ASSIGNABLE_ROLES.includes(role)) throw new ApiError(400, "Invalid role")
  const target = await loadTarget(actor, id)
  const oldRole = target.role
  if (oldRole === role) return target
  target.role = role
  await target.save()
  // One entry per effect: the old privileged role removed, the new one granted.
  if (oldRole !== "customer") await audit(actor, target, { action: `${ROLE_LABEL[oldRole]}_REMOVED`, oldRole, newRole: role })
  if (role !== "customer") await audit(actor, target, { action: `${ROLE_LABEL[role]}_GRANTED`, oldRole, newRole: role })
  return target
}

// state: "grant" | "deny" | "inherit" (back to the role default).
export async function setPermission(actor, id, permission, state) {
  if (!isPermission(permission)) throw new ApiError(400, "Unknown permission")
  if (!["grant", "deny", "inherit"].includes(state)) throw new ApiError(400, "Invalid permission state")
  const target = await loadTarget(actor, id)
  if (state === "grant" && !isGrantable(permission, target.role)) throw new ApiError(400, "This permission is reserved for the Super Admin")
  const grants = new Set(target.permissionGrants || [])
  const denies = new Set(target.permissionDenies || [])
  grants.delete(permission)
  denies.delete(permission)
  if (state === "grant") grants.add(permission)
  if (state === "deny") denies.add(permission)
  target.permissionGrants = [...grants]
  target.permissionDenies = [...denies]
  await target.save()
  const action = { grant: "PERMISSION_GRANTED", deny: "PERMISSION_DENIED", inherit: "PERMISSION_RESTORED" }[state]
  await audit(actor, target, { action, permission, oldRole: target.role, newRole: target.role })
  return target
}

export async function resetPermissions(actor, id) {
  const target = await loadTarget(actor, id)
  target.permissionGrants = []
  target.permissionDenies = []
  await target.save()
  await audit(actor, target, { action: "PERMISSIONS_RESET", oldRole: target.role, newRole: target.role })
  return target
}

// ---------------------------------------------------------------------------
// Account status
// ---------------------------------------------------------------------------

// status: "banned" | "active". A ban takes effect on the account's very next
// API request (lib/auth.js checks the stored status every time).
export async function setAccountStatus(actor, id, status, reason = "") {
  if (!["banned", "active"].includes(status)) throw new ApiError(400, "Invalid account status")
  const target = await loadTarget(actor, id)
  const current = target.status === "banned" ? "banned" : "active"
  if (current === status) return target
  const cleanReason = String(reason ?? "").replace(/\u0000/g, "").trim().slice(0, BAN_REASON_MAX)
  if (status === "banned" && target.email) {
    // An email-wide ban must never reach the Super Admin (e.g. via a duplicate profile).
    for (const profile of await User.find(emailQuery(target.email))) {
      if (await isProtectedSuperAdmin(profile)) throw new ApiError(403, "The Super Admin account can't be modified")
    }
  }
  // A ban covers the person, not just this profile: every profile with the
  // same email, and a lasting ban record (email + Firebase UIDs) that also
  // blocks signing up again or signing in another way — even after deletion.
  if (status === "banned") await banIdentity({ user: target, actor, reason: cleanReason })
  else await liftIdentityBan({ user: target, actor })
  await audit(actor, target, {
    action: status === "banned" ? "USER_BANNED" : "USER_UNBANNED",
    oldRole: target.role,
    newRole: target.role,
    detail: status === "banned" ? cleanReason : "",
  })
  return User.findById(target._id)
}

// Removes the account's profile, its private notes (with their files and
// history) and its notifications, and records the deletion (DeletedUser).
// The person may sign up again later and gets a brand-new customer profile —
// nothing of this one comes back. Business
// records — orders, invoices, appointments, chats — are kept: they belong to
// the company's books, not the profile. A ban (AccountBan) is never removed
// by deleting: a banned person stays banned.
export async function deleteUser(actor, id) {
  const target = await loadTarget(actor, id)
  // A banned account stays listed so it can always be unbanned; deleting it
  // would leave a ban nobody could lift from the dashboard.
  if (target.status === "banned") throw new ApiError(409, "Unban this account before deleting it")
  const snapshot = { _id: target._id, email: target.email, name: target.name }
  for (const uid of [target.firebaseUid, ...(target.linkedFirebaseUids || [])]) {
    await DeletedUser.updateOne(
      { firebaseUid: uid },
      { $setOnInsert: { firebaseUid: uid, email: target.email, name: target.name, role: target.role, deletedBy: actor._id, deletedByEmail: actor.email } },
      { upsert: true }
    )
  }
  await deleteNotesOfUser(target._id)
  await Notification.deleteMany({ user: target._id })
  await target.deleteOne()
  await audit(actor, snapshot, { action: "USER_DELETED", oldRole: target.role, newRole: null })
  return snapshot
}

// ---------------------------------------------------------------------------
// Role permission sets
// ---------------------------------------------------------------------------

// Everything the role matrix needs: each editable role's current set, the
// code defaults it can be reset to, and which cells are locked for it.
export async function roleMatrix() {
  const docs = await RolePermission.find({ role: { $in: EDITABLE_ROLES } }).lean()
  const byRole = new Map(docs.map((d) => [d.role, d]))
  return {
    roles: EDITABLE_ROLES.map((role) => {
      const doc = byRole.get(role)
      return {
        role,
        permissions: doc ? sanitizeRolePermissions(role, doc.permissions) : roleDefaults(role),
        defaults: roleDefaults(role),
        customized: Boolean(doc),
        updatedAt: doc?.updatedAt || null,
        updatedByEmail: doc?.updatedByEmail || "",
        locked: PERMISSIONS.filter((p) => !isGrantable(p, role)),
      }
    }),
    superAdminOnly: NON_GRANTABLE,
    roleLocked: ROLE_LOCKED,
  }
}

function assertEditableRole(role) {
  // "superadmin" always has everything and isn't a stored role; customers
  // have no permission set. Neither can be edited.
  if (!EDITABLE_ROLES.includes(role)) throw new ApiError(400, "This role's permissions can't be changed")
}

export async function saveRolePermissions(actor, role, permissions) {
  assertEditableRole(role)
  if (!Array.isArray(permissions) || permissions.some((p) => typeof p !== "string")) throw new ApiError(400, "Invalid permission list")
  // Refuse (rather than silently drop) anything a role may never hold, so the
  // Super Admin sees exactly what was saved.
  for (const p of permissions) {
    if (!isPermission(p)) throw new ApiError(400, "Unknown permission")
    if (!isGrantable(p, role)) throw new ApiError(400, "This permission is reserved for the Super Admin")
  }
  const next = sanitizeRolePermissions(role, permissions)
  const before = resolveRoleBase(role, await getRolePermissionConfig())
  await RolePermission.updateOne(
    { role },
    { $set: { role, permissions: next, updatedBy: actor._id, updatedByEmail: actor.email } },
    { upsert: true }
  )
  invalidateRolePermissionCache()
  const added = next.filter((p) => !before.includes(p))
  const removed = before.filter((p) => !next.includes(p))
  if (added.length || removed.length) await audit(actor, null, { action: "ROLE_PERMISSIONS_UPDATED", role, added, removed })
  return roleMatrix()
}

export async function resetRolePermissions(actor, role) {
  assertEditableRole(role)
  const res = await RolePermission.deleteOne({ role })
  invalidateRolePermissionCache()
  if (res.deletedCount) await audit(actor, null, { action: "ROLE_PERMISSIONS_RESET", role })
  return roleMatrix()
}
