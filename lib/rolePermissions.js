import { RolePermission } from "./models/RolePermission.js"
import { EDITABLE_ROLES, sanitizeRolePermissions } from "./permissions.js"

// The Super Admin's saved permission sets, as { role: [keys] } for the
// customized roles only (a role missing here uses ROLE_DEFAULTS). Read on
// every authenticated request (lib/auth.js), so it's cached briefly; a save
// in this process clears the cache at once, other server instances pick the
// change up within CACHE_MS.
const CACHE_MS = 5000
let cache = { value: null, at: 0 }

export async function getRolePermissionConfig() {
  if (cache.value && Date.now() - cache.at < CACHE_MS) return cache.value
  const docs = await RolePermission.find({ role: { $in: EDITABLE_ROLES } }).lean()
  const value = {}
  for (const doc of docs) value[doc.role] = sanitizeRolePermissions(doc.role, doc.permissions)
  cache = { value, at: Date.now() }
  return value
}

export function invalidateRolePermissionCache() {
  cache = { value: null, at: 0 }
}
