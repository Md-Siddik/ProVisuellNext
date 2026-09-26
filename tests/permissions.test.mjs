// Pure tests for the RBAC registry and meeting attendance. No DB/network.
import test from "node:test"
import assert from "node:assert/strict"
import {
  EDITABLE_ROLES,
  NON_GRANTABLE,
  PERMISSIONS,
  ROLE_DEFAULTS,
  computeEffectivePermissions,
  explainPermission,
  isGrantable,
  resolveRoleBase,
  sanitizeRolePermissions,
} from "../lib/permissions.js"
import { buildAccess } from "../lib/access.js"
import { attendanceStatus, customerCanCancel, customerCanReschedule, joinWindow } from "../lib/appointments/attendance.js"

const has = (role, p, grants = [], denies = []) => computeEffectivePermissions({ role, grants, denies }).includes(p)

test("administrator: every operational permission, never access control", () => {
  for (const p of PERMISSIONS) assert.equal(has("administrator", p), !NON_GRANTABLE.includes(p), p)
  for (const p of ["roles.manage", "permissions.manage", "users.view", "audit.view"]) assert.equal(has("administrator", p), false)
})

test("owner keeps what it had (no CMS), no access control", () => {
  assert.equal(has("owner", "orders.approve"), true)
  assert.equal(has("owner", "reports.view"), true)
  assert.equal(has("owner", "cms.edit"), false)
  assert.equal(has("owner", "roles.manage"), false)
})

test("moderator: strict defaults", () => {
  const allowed = ["messages.view", "messages.reply", "blog.create", "blog.edit", "blog.publish", "blog.analytics", "appointments.view"]
  for (const p of allowed) assert.equal(has("moderator", p), true, p)
  const denied = [
    "messages.sendEmail", "messages.viewEmailInbox", "appointments.create", "appointments.cancel",
    "appointments.manageAvailability", "invoices.view", "reports.view", "orders.approve", "orders.reject",
    "orders.view", "customers.viewEmail", "customers.viewPhone", "customers.viewAddress", "customers.viewLocation",
    "roles.manage", "permissions.manage", "blog.delete", "invoices.recordPayment",
  ]
  for (const p of denied) assert.equal(has("moderator", p), false, p)
})

test("customer and unknown roles get nothing by default", () => {
  assert.deepEqual(ROLE_DEFAULTS.customer, [])
  assert.deepEqual(computeEffectivePermissions({ role: "customer" }), [])
  assert.deepEqual(computeEffectivePermissions({ role: "superadmin" }), []) // not a stored role
  assert.deepEqual(computeEffectivePermissions({ role: undefined }), [])
})

test("effective = defaults + grants − denies; deny wins; unknown keys ignored", () => {
  assert.equal(has("administrator", "orders.approve", [], ["orders.approve"]), false)
  assert.equal(has("administrator", "orders.reject", [], ["orders.approve"]), true)
  assert.equal(has("moderator", "reports.view", ["reports.view"]), true)
  assert.equal(has("moderator", "reports.view", ["reports.view"], ["reports.view"]), false)
  assert.deepEqual(computeEffectivePermissions({ role: "customer", grants: ["made.up"] }), [])
})

test("access-control permissions can't be granted to anyone", () => {
  for (const p of NON_GRANTABLE) {
    assert.equal(isGrantable(p), false)
    assert.equal(has("administrator", p, [p]), false, p)
  }
})

test("older users without override fields get their role defaults", () => {
  const legacy = { role: "administrator" } // no permissionGrants / permissionDenies
  const access = buildAccess(legacy, false)
  assert.equal(access.role, "administrator")
  assert.equal(access.can("orders.approve"), true)
  assert.equal(access.can("roles.manage"), false)
})

test("Super Admin bypasses everything, whatever the stored role says", () => {
  const access = buildAccess({ role: "customer", permissionDenies: PERMISSIONS }, true)
  assert.equal(access.role, "superadmin")
  for (const p of PERMISSIONS) assert.equal(access.can(p), true, p)
})

test("role permission sets: saved config replaces the defaults for that role only", () => {
  const config = { administrator: ["orders.view", "reports.view"] }
  const admin = buildAccess({ role: "administrator" }, false, config)
  assert.equal(admin.can("orders.view"), true)
  assert.equal(admin.can("orders.approve"), false, "removed from the role")
  assert.equal(buildAccess({ role: "owner" }, false, config).can("orders.approve"), true, "other roles untouched")
  // Per-user overrides still apply on top of the role's set.
  assert.equal(buildAccess({ role: "administrator", permissionGrants: ["orders.approve"] }, false, config).can("orders.approve"), true)
  assert.equal(buildAccess({ role: "administrator", permissionDenies: ["reports.view"] }, false, config).can("reports.view"), false)
  // No config for a role → built-in defaults.
  assert.deepEqual(resolveRoleBase("moderator", config), ROLE_DEFAULTS.moderator)
})

test("role permission sets can't escalate: access control and role locks survive any stored value", () => {
  const stored = ["roles.manage", "users.delete", "users.ban", "permissions.manage", "made.up", "orders.view", "notes.view"]
  assert.deepEqual(sanitizeRolePermissions("administrator", stored), ["orders.view", "notes.view"])
  assert.deepEqual(sanitizeRolePermissions("customer", ["orders.view"]), [], "customers have no editable set")
  assert.deepEqual(sanitizeRolePermissions("superadmin", ["orders.view"]), [], "superadmin isn't a stored role")
  const access = buildAccess({ role: "moderator" }, false, { moderator: stored })
  for (const p of NON_GRANTABLE) assert.equal(access.can(p), false, p)
  assert.deepEqual(EDITABLE_ROLES, ["administrator", "owner", "moderator"])
})

test("user management powers are Super Admin only", () => {
  for (const p of ["users.view", "users.ban", "users.delete", "roles.manage", "permissions.manage"]) {
    assert.ok(NON_GRANTABLE.includes(p), p)
    for (const role of ["administrator", "owner", "moderator"]) assert.equal(has(role, p, [p]), false, `${role} ${p}`)
  }
  assert.equal(buildAccess({ role: "customer" }, true).can("users.delete"), true)
})

test("permission explanation for the editor", () => {
  const u = { role: "administrator", grants: [], denies: ["orders.approve"] }
  assert.deepEqual(explainPermission(u, "orders.approve"), { state: "denied", inherited: true, effective: false })
  assert.deepEqual(explainPermission(u, "orders.reject"), { state: "inherited", inherited: true, effective: true })
  assert.deepEqual(explainPermission({ role: "moderator", grants: ["reports.view"] }, "reports.view"), { state: "granted", inherited: false, effective: true })
})

test("attendance: scheduled → joined / missed", () => {
  const now = new Date("2026-10-05T10:00:00Z")
  const upcoming = { start: "2026-10-05T11:00:00Z", end: "2026-10-05T11:30:00Z" }
  const ended = { start: "2026-10-05T09:00:00Z", end: "2026-10-05T09:30:00Z" }
  assert.equal(attendanceStatus(upcoming, now), "scheduled")
  assert.equal(attendanceStatus(ended, now), "missed")
  assert.equal(attendanceStatus({ ...ended, joinedAt: "2026-10-05T09:02:00Z" }, now), "joined")
  assert.equal(attendanceStatus({ ...upcoming, joinedAt: "2026-10-05T10:50:00Z" }, now), "joined")
})

test("join window: customers from the start, staff 15 minutes early, until the end", () => {
  const appt = { start: "2026-10-05T11:00:00Z", end: "2026-10-05T11:30:00Z" }
  assert.equal(joinWindow(appt, new Date("2026-10-05T10:59:59Z")), "too_early")
  assert.equal(joinWindow(appt, new Date("2026-10-05T11:00:00Z")), "open")
  assert.equal(joinWindow(appt, new Date("2026-10-05T10:46:00Z"), 15), "open")
  assert.equal(joinWindow(appt, new Date("2026-10-05T10:40:00Z"), 15), "too_early")
  assert.equal(joinWindow(appt, new Date("2026-10-05T11:29:00Z")), "open")
  assert.equal(joinWindow(appt, new Date("2026-10-05T11:30:00Z")), "ended")
})

test("customer reschedule needs a full hour; cancel only before the start", () => {
  const appt = { status: "scheduled", start: "2026-10-05T11:00:00Z", end: "2026-10-05T11:30:00Z" }
  assert.equal(customerCanReschedule(appt, new Date("2026-10-05T10:00:00Z")), true)
  assert.equal(customerCanReschedule(appt, new Date("2026-10-05T10:00:01Z")), false)
  assert.equal(customerCanReschedule({ ...appt, status: "cancelled" }, new Date("2026-10-05T08:00:00Z")), false)
  assert.equal(customerCanCancel(appt, new Date("2026-10-05T10:59:00Z")), true)
  assert.equal(customerCanCancel(appt, new Date("2026-10-05T11:00:00Z")), false)
})
