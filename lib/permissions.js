// Central permission registry — the single place that defines what each
// permission key means and which roles get it by default. Shared by the API
// (enforcement) and the UI (visibility only). No dependencies, so it runs in
// both.
//
// Effective permissions = role permissions + explicit per-user grants
//                                           − explicit per-user denies.
// Role permissions are the Super Admin's saved configuration for that role
// (RolePermission collection, lib/rolePermissions.js) or, until one is
// saved, the code defaults below. The protected Super Admin bypasses all of
// this (see lib/access.js).

export const ROLES = ["owner", "administrator", "moderator", "customer"]
// Assignable through the Super Admin control center. "superadmin" is never
// a stored or assignable role — it's resolved from the server-side identity.
export const ASSIGNABLE_ROLES = ROLES
export const STAFF_ROLES = ["owner", "administrator", "moderator"]
// Roles whose permission set the Super Admin can edit as a whole. Customers
// act on their own data only (ownership checks), so they have no matrix.
export const EDITABLE_ROLES = ["administrator", "owner", "moderator"]

export const NOTES_PERMISSIONS = ["notes.view", "notes.create", "notes.edit", "notes.delete", "notes.share"]

export const PERMISSION_GROUPS = [
  {
    key: "messages",
    permissions: [
      "messages.view", // customer chat conversations
      "messages.reply", // reply in the website chat
      "messages.viewEmailInbox", // contact-form emails (contain sender addresses)
      "messages.sendEmail", // reply to / compose customer emails
    ],
  },
  {
    key: "blog",
    permissions: [
      "blog.view",
      "blog.create",
      "blog.edit",
      "blog.delete",
      "blog.publish",
      "blog.analytics",
      "blog.moderateComments",
      "blog.settings",
    ],
  },
  {
    key: "appointments",
    permissions: [
      "appointments.view",
      "appointments.create",
      "appointments.cancel",
      "appointments.reschedule",
      "appointments.manageAvailability",
    ],
  },
  {
    key: "orders",
    permissions: ["orders.view", "orders.create", "orders.approve", "orders.reject", "orders.complete"],
  },
  {
    key: "invoices",
    permissions: ["invoices.view", "invoices.create", "invoices.send", "invoices.recordPayment"],
  },
  { key: "reports", permissions: ["reports.view", "expenses.view", "expenses.create"] },
  {
    key: "customers",
    permissions: [
      "customers.viewBasic",
      "customers.viewEmail",
      "customers.viewPhone",
      "customers.viewAddress",
      "customers.viewLocation",
    ],
  },
  // Website Editor.
  { key: "cms", permissions: ["cms.view", "cms.edit"] },
  // Internal staff notes, to-dos and reminders (see ROLE_LOCKED below).
  //   view   open Notes; see own notes and notes shared with you
  //   create write new notes / to-dos
  //   edit   change own notes, and shared notes whose creator allows editing
  //   delete delete own notes
  //   share  change who an own note is shared with
  { key: "notes", permissions: NOTES_PERMISSIONS },
  // Super Admin only — no role gets these, and they can't be granted to
  // anyone else (see NON_GRANTABLE).
  {
    key: "users",
    permissions: ["users.view", "users.ban", "users.delete", "roles.manage", "permissions.manage", "audit.view"],
  },
]

export const PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.permissions)

// Access-control powers stay with the Super Admin — neither a role
// configuration nor a per-user grant can hand them to someone else.
export const NON_GRANTABLE = ["users.view", "users.ban", "users.delete", "roles.manage", "permissions.manage", "audit.view"]

// Permissions that only certain roles may ever hold. They can be denied to an
// individual, but neither a role configuration nor a per-user grant can
// extend them to another role (internal notes never reach a customer).
export const ROLE_LOCKED = Object.fromEntries(NOTES_PERMISSIONS.map((p) => [p, STAFF_ROLES]))

// Keys that no longer exist, stored on older users' overrides. Each expands
// to its replacements, so an old grant or deny keeps its meaning.
export const LEGACY_ALIASES = {
  "notes.use": NOTES_PERMISSIONS,
}

const OPERATIONAL = PERMISSIONS.filter((p) => !NON_GRANTABLE.includes(p))

export const ROLE_DEFAULTS = {
  // Everything operational.
  administrator: OPERATIONAL,
  // What owners could already do: everything except the website CMS.
  owner: OPERATIONAL.filter((p) => !p.startsWith("cms.")),
  // Strict: website chat, blog authoring, read-only appointments; notes
  // others share with them (editable only where the creator allows it).
  moderator: [
    "messages.view",
    "messages.reply",
    "blog.view",
    "blog.create",
    "blog.edit",
    "blog.publish",
    "blog.analytics",
    "appointments.view",
    "notes.view",
    "notes.edit",
  ],
  // Customers act on their own data only (checked by ownership, not permissions).
  customer: [],
}

export function isPermission(key) {
  return PERMISSIONS.includes(key)
}

function roleMayHold(key, role) {
  return !ROLE_LOCKED[key] || role === undefined || ROLE_LOCKED[key].includes(role)
}

export function isGrantable(key, role) {
  if (!isPermission(key) || NON_GRANTABLE.includes(key)) return false
  return roleMayHold(key, role)
}

export function roleDefaults(role) {
  return ROLE_DEFAULTS[role] || []
}

// A role permission list as it may be stored: known keys only, never an
// access-control power, never a key the role may not hold. Registry order.
export function sanitizeRolePermissions(role, list) {
  if (!EDITABLE_ROLES.includes(role)) return []
  const wanted = new Set(Array.isArray(list) ? list : [])
  return PERMISSIONS.filter((p) => wanted.has(p) && isGrantable(p, role))
}

// The permissions a role starts from: the Super Admin's saved configuration
// for it (`config` = { role: [keys] }, customized roles only), else the code
// defaults.
export function resolveRoleBase(role, config) {
  const saved = config?.[role]
  return Array.isArray(saved) ? sanitizeRolePermissions(role, saved) : roleDefaults(role)
}

function expand(keys) {
  return (keys || []).flatMap((k) => LEGACY_ALIASES[k] || [k])
}

// role permissions + grants − denies. Unknown keys are ignored, so a stale
// override in the database can never create a permission that doesn't exist.
// `base` (optional) is the role's configured list (resolveRoleBase).
export function computeEffectivePermissions({ role, grants = [], denies = [], base }) {
  const set = new Set(base ?? roleDefaults(role))
  for (const p of expand(grants)) if (isGrantable(p, role ?? null)) set.add(p)
  for (const p of expand(denies)) set.delete(p)
  return PERMISSIONS.filter((p) => set.has(p))
}

// Per-permission explanation for the per-user permission editor.
export function explainPermission({ role, grants = [], denies = [], base }, key) {
  const inherited = (base ?? roleDefaults(role)).includes(key)
  if (expand(denies).includes(key)) return { state: "denied", inherited, effective: false }
  if (expand(grants).includes(key) && isGrantable(key, role)) return { state: "granted", inherited, effective: true }
  return { state: "inherited", inherited, effective: inherited }
}
