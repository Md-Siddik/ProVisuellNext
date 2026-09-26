import { ApiError } from "./apiError.js"
import { SystemConfig } from "./models/SystemConfig.js"
import { computeEffectivePermissions, PERMISSIONS, resolveRoleBase } from "./permissions.js"

// Server-side authorization. Every decision here is made from the verified
// Firebase token and the database — never from a role, permission list or
// email the client sends.
//
// Super Admin: exactly one account, configured by SUPER_ADMIN_EMAIL. The
// first time that address signs in *with a verified email*, its immutable
// Firebase UID is pinned in SystemConfig; from then on only that UID is the
// Super Admin. The Mongo `role` field plays no part, so editing it can
// neither grant nor remove Super Admin access.

const DEFAULT_SUPER_ADMIN_EMAIL = "abusiddik9994@gmail.com"

export function superAdminEmail() {
  return String(process.env.SUPER_ADMIN_EMAIL || DEFAULT_SUPER_ADMIN_EMAIL).trim().toLowerCase()
}

// Short cache so every request doesn't need a lookup; the pin is write-once.
let pinCache = { value: undefined, at: 0 }

async function getPin() {
  if (pinCache.value !== undefined && Date.now() - pinCache.at < 60000) return pinCache.value
  const doc = await SystemConfig.findOne({ key: "superadmin" }).lean()
  pinCache = { value: doc?.firebaseUid ? doc : null, at: Date.now() }
  return pinCache.value
}

// Is this verified token the Super Admin? Pins the UID on first sight.
export async function resolveSuperAdmin(decoded, user) {
  const pin = await getPin()
  // The pinned identity, or another sign-in method linked to the very same
  // profile (linking needs the same provider-verified email —
  // lib/accountIdentity.js), so e.g. "Continue with Google" keeps the role.
  if (pin) return decoded.sub === pin.firebaseUid || (Boolean(user) && profileHasUid(user, pin.firebaseUid))

  const email = String(decoded.email || "").toLowerCase()
  const verified = decoded.email_verified === true || user?.emailVerified === true
  if (!email || email !== superAdminEmail() || !verified) return false

  // First writer wins; a concurrent request just reads the same pin back.
  const doc = await SystemConfig.findOneAndUpdate(
    { key: "superadmin" },
    { $setOnInsert: { key: "superadmin", firebaseUid: decoded.sub, email, pinnedAt: new Date() } },
    { upsert: true, new: true }
  ).lean()
  pinCache = { value: doc, at: Date.now() }
  return doc.firebaseUid === decoded.sub
}

// Whether a stored user is the protected Super Admin (for role-management
// guards). Falls back to the configured email before the UID is pinned.
function profileHasUid(user, uid) {
  return user.firebaseUid === uid || (user.linkedFirebaseUids || []).includes(uid)
}

export async function isProtectedSuperAdmin(targetUser) {
  if (!targetUser) return false
  const pin = await getPin()
  if (pin) return profileHasUid(targetUser, pin.firebaseUid)
  return String(targetUser.email || "").toLowerCase() === superAdminEmail()
}

// The permissions a stored user holds (never the Super Admin — callers check
// that first). `roleConfig` is getRolePermissionConfig()'s result.
export function userPermissions(user, roleConfig) {
  return computeEffectivePermissions({
    role: user.role,
    grants: user.permissionGrants,
    denies: user.permissionDenies,
    base: resolveRoleBase(user.role, roleConfig),
  })
}

// The effective access of an authenticated user.
export function buildAccess(user, isSuperAdmin, roleConfig = null) {
  const permissions = isSuperAdmin ? [...PERMISSIONS] : userPermissions(user, roleConfig)
  const set = new Set(permissions)
  return {
    role: isSuperAdmin ? "superadmin" : user.role,
    baseRole: user.role,
    isSuperAdmin: Boolean(isSuperAdmin),
    permissions,
    can: (permission) => set.has(permission),
  }
}

export function getEffectivePermissions(auth) {
  return auth.access.permissions
}

export function can(auth, permission) {
  return Boolean(auth?.access?.can(permission))
}

// hasPermission(auth, "notes.share") — the same check under the name the
// rest of the permission utilities use.
export const hasPermission = can

// Throws 403 unless the user has every listed permission.
export function requirePermission(auth, ...permissions) {
  for (const p of permissions) {
    if (!can(auth, p)) throw new ApiError(403, "Not allowed for your role")
  }
  return auth
}

// Throws 403 unless the user has at least one of the listed permissions.
export function requireAnyPermission(auth, ...permissions) {
  if (!permissions.some((p) => can(auth, p))) throw new ApiError(403, "Not allowed for your role")
  return auth
}

export function requireSuperAdmin(auth) {
  if (!auth?.access?.isSuperAdmin) throw new ApiError(403, "Not allowed for your role")
  return auth
}

// Strips customer contact fields the viewer isn't allowed to see. `fields`
// maps a permission to the object keys it guards, e.g.
//   { "customers.viewEmail": ["customerEmail"], "customers.viewPhone": ["phone"] }
// Returns a plain copy; the original is untouched.
export function redact(auth, obj, fields) {
  if (!obj) return obj
  const plain = typeof obj.toObject === "function" ? obj.toObject() : { ...obj }
  for (const [permission, keys] of Object.entries(fields)) {
    if (can(auth, permission)) continue
    for (const key of keys) {
      if (key in plain) plain[key] = null
    }
  }
  return plain
}

export const CUSTOMER_CONTACT_FIELDS = {
  "customers.viewEmail": ["customerEmail", "requestedByEmail", "email"],
  "customers.viewPhone": ["customerPhone", "phone"],
  "customers.viewAddress": ["customerAddress", "address", "billingAddress", "deliveryAddress"],
}
