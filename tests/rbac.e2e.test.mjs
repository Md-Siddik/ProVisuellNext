// End-to-end tests against the real built app (`next start`), real Firebase
// Authentication and a throwaway MongoDB database.
//
//   npm run build && npm run test:e2e
//
// What it does, and what it cleans up:
//  - creates temporary Firebase email/password accounts (…@example.com) and
//    deletes them again at the end;
//  - starts the server with MONGO_URI pointed at "provisuell_e2e_test" (the
//    real database is never used — this is proven before any signed-in
//    request) and drops that database at the end;
//  - sets SUPER_ADMIN_EMAIL to a temporary account, so the real Super Admin
//    pin is untouched;
//  - points SMTP at an unreachable host so no real email can be sent.
import test, { after, before } from "node:test"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import crypto from "node:crypto"
import dotenv from "dotenv"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

dotenv.config({ path: ".env.local" })
const TEST_DB = "provisuell_e2e_test"
const PORT = 3125
const BASE = `http://localhost:${PORT}`
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
const REFERER = `${(process.env.CLIENT_URL || "http://localhost:3000").replace(/\/$/, "")}/`
const TEST_URI = process.env.MONGO_URI.replace(/(mongodb(?:\+srv)?:\/\/[^/]+)\/[^?]*/, `$1/${TEST_DB}`)
process.env.MONGO_URI = TEST_URI

const mongoose = (await import("mongoose")).default
const { connectDB } = await import("../lib/db.js")
const { User } = await import("../lib/models/User.js")
const { Appointment } = await import("../lib/models/Appointment.js")
const { Conversation } = await import("../lib/models/Conversation.js")
const { Order } = await import("../lib/models/Order.js")
const { AuditLog } = await import("../lib/models/AuditLog.js")
const { SystemConfig } = await import("../lib/models/SystemConfig.js")
const { AvailabilityOverride } = await import("../lib/models/AvailabilityOverride.js")
const { PendingSignup } = await import("../lib/models/PendingSignup.js")
const { encryptPassword, hashKey, buildToken } = await import("../lib/pendingSignup.js")

const run = crypto.randomBytes(4).toString("hex")
const MEET = `https://meet.google.com/e2e-${crypto.randomBytes(3).toString("hex")}`
const { Invoice } = await import("../lib/models/Invoice.js")
const CRON_SECRET = crypto.randomBytes(24).toString("hex")
const PRIVATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "pv-e2e-private-"))
const { addDays, getNorwayNow, osloToUtc } = await import("../lib/appointments/time.js")
const emailFor = (label) => `pv-e2e-${run}-${label}@example.com`
const PASSWORD = `E2e-${crypto.randomBytes(6).toString("hex")}`
const accounts = {} // label -> { uid, idToken, email, user }
const createdTokens = [] // every Firebase account to delete afterwards
let server
const serverErrors = []

async function firebase(method, body) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: REFERER },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Firebase ${method}: ${data?.error?.message}`)
  return data
}

async function call(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  return { status: res.status, data }
}
const as = (label) => accounts[label].idToken

async function makeAccount(label, role) {
  const email = emailFor(label)
  const { localId, idToken } = await firebase("signUp", { email, password: PASSWORD, returnSecureToken: true })
  createdTokens.push(idToken)
  // Password signups are confirmed by our own link in production; seed that state.
  const user = await User.create({ firebaseUid: localId, email, name: `E2E ${label}`, role, emailVerified: true })
  accounts[label] = { uid: localId, idToken, email, user }
}

before(async () => {
  await connectDB()
  assert.equal(mongoose.connection.name, TEST_DB)
  await mongoose.connection.dropDatabase()

  // Marker only the test database has — used to prove the server is on it.
  await AvailabilityOverride.create({ type: "single_date", startDate: "2099-01-01", endDate: "2099-01-01", allDay: true, available: false })

  await makeAccount("super", "customer") // Mongo role deliberately "customer"
  await makeAccount("admin", "administrator")
  await makeAccount("owner", "owner")
  await makeAccount("mod", "moderator")
  await makeAccount("cust", "customer")
  await makeAccount("target", "customer")
  // Second owner / administrator for the Notes privacy scenarios.
  await makeAccount("owner2", "owner")
  await makeAccount("admin2", "administrator")
  // User management: one account to ban and unban, one to delete.
  await makeAccount("banme", "administrator")
  await makeAccount("victim", "customer")
  // Permanent bans across signup, login and deletion.
  await makeAccount("banned2", "customer")

  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORT)], {
    env: {
      ...process.env,
      MONGO_URI: TEST_URI,
      SUPER_ADMIN_EMAIL: accounts.super.email,
      MEET_LINK: MEET,
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "9",
      SMTP_USER: "e2e",
      SMTP_PASS: "e2e",
      NODE_ENV: "production",
      // Built with NEXT_DIST_DIR=.next-e2e (see package.json test:e2e) so a
      // running dev server's .next is never touched.
      NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || ".next-e2e",
      // Notes: reminders are driven through the cron route in these tests.
      NOTES_REMINDER_TICKER: "off",
      CRON_SECRET,
      PRIVATE_STORAGE_DIR: PRIVATE_DIR,
    },
    stdio: ["ignore", "pipe", "pipe"],
  })
  // Drain the server's output (an unread pipe can stall it); keep errors for debugging.
  server.stdout.resume()
  server.stderr.on("data", (d) => serverErrors.push(String(d)))
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).status < 500) break
    } catch {}
    await new Promise((r) => setTimeout(r, 1000))
  }
  // Safety gate: the server must be reading the test database.
  const probe = await call("/appointments/availability?date=2099-01-01")
  assert.equal(probe.status, 200)
  assert.equal(probe.data.slots.filter((s) => s.available).length, 0, "server is NOT on the test database — aborting")
})

after(async () => {
  fs.rmSync(PRIVATE_DIR, { recursive: true, force: true })
  if (serverErrors.length) console.log(`server stderr:\n${serverErrors.join("").slice(-3000)}`)
  server?.kill()
  for (const idToken of createdTokens) await firebase("delete", { idToken }).catch(() => {})
  if (mongoose.connection.name === TEST_DB) await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
})

// ---------------------------------------------------------------------------
// Super Admin
// ---------------------------------------------------------------------------

test("Super Admin: resolved from verified identity, pinned by UID, Mongo role irrelevant", async () => {
  const { status, data } = await call("/auth/sync", { method: "POST", token: as("super"), body: {} })
  assert.equal(status, 200)
  assert.equal(data.access.role, "superadmin")
  assert.equal(data.access.isSuperAdmin, true)
  assert.equal(data.user.role, "customer")
  const pin = await SystemConfig.findOne({ key: "superadmin" }).lean()
  assert.equal(pin.firebaseUid, accounts.super.uid)
  // Editing the Mongo role field changes nothing.
  await User.updateOne({ _id: accounts.super.user._id }, { role: "moderator" })
  assert.equal((await call("/auth/me", { token: as("super") })).data.access.isSuperAdmin, true)
})

test("Super Admin: control center APIs work", async () => {
  const list = await call(`/superadmin/users?search=${run}`, { token: as("super") })
  assert.equal(list.status, 200)
  assert.equal(list.data.total, 11)
  assert.ok(list.data.users.every((u) => u.status === "active"), "existing users default to active")
  assert.equal(list.data.users.find((u) => u.email === accounts.super.email).isSuperAdmin, true)
})

test("Super Admin: promote / demote roles, grant / deny / reset, audit trail", async () => {
  const id = accounts.target.user._id
  const patch = (body) => call(`/superadmin/users/${id}`, { method: "PATCH", token: as("super"), body })

  let r = await patch({ role: "administrator" })
  assert.equal(r.status, 200)
  assert.equal(r.data.user.role, "administrator")
  r = await patch({ role: "customer" })
  assert.equal(r.data.user.role, "customer")
  r = await patch({ role: "owner" })
  assert.equal(r.data.user.role, "owner")
  r = await patch({ role: "moderator" })
  assert.equal(r.data.user.role, "moderator")

  r = await patch({ permission: "reports.view", state: "grant" })
  assert.ok(r.data.user.effectivePermissions.includes("reports.view"))
  assert.equal(r.data.user.permissions.find((p) => p.key === "reports.view").state, "granted")
  // The grant takes effect on the very next request.
  const targetToken = (await firebase("signInWithPassword", { email: accounts.target.email, password: PASSWORD, returnSecureToken: true })).idToken
  assert.equal((await call("/reports/monthly", { token: targetToken })).status, 200)

  r = await patch({ permission: "messages.reply", state: "deny" })
  assert.ok(!r.data.user.effectivePermissions.includes("messages.reply"))
  r = await patch({ reset: true })
  assert.deepEqual([r.data.user.grants, r.data.user.denies], [[], []])
  assert.equal((await call("/reports/monthly", { token: targetToken })).status, 403)

  const actions = (await AuditLog.find({ target: id }).sort({ createdAt: 1 }).lean()).map((e) => e.action)
  assert.deepEqual(actions, [
    "ADMIN_GRANTED",
    "ADMIN_REMOVED",
    "OWNER_GRANTED",
    "OWNER_REMOVED",
    "MODERATOR_GRANTED",
    "PERMISSION_GRANTED",
    "PERMISSION_DENIED",
    "PERMISSIONS_RESET",
  ])
  const audit = await call(`/superadmin/audit?target=${id}`, { token: as("super") })
  assert.equal(audit.status, 200)
  assert.equal(audit.data.total, 8)
  assert.equal(audit.data.entries[0].actorEmail, accounts.super.email)
})

test("Super Admin: cannot be modified, 'superadmin' is not assignable, access powers not grantable", async () => {
  const self = await call(`/superadmin/users/${accounts.super.user._id}`, { method: "PATCH", token: as("super"), body: { role: "customer" } })
  assert.equal(self.status, 403)
  const id = accounts.target.user._id
  assert.equal((await call(`/superadmin/users/${id}`, { method: "PATCH", token: as("super"), body: { role: "superadmin" } })).status, 400)
  assert.equal((await call(`/superadmin/users/${id}`, { method: "PATCH", token: as("super"), body: { permission: "roles.manage", state: "grant" } })).status, 400)
})

// ---------------------------------------------------------------------------
// Administrator / owner
// ---------------------------------------------------------------------------

test("Administrator: normal operations work, Super Admin APIs and role changes denied", async () => {
  const sync = await call("/auth/sync", { method: "POST", token: as("admin"), body: {} })
  assert.equal(sync.data.access.role, "administrator")
  assert.ok(!sync.data.access.permissions.includes("roles.manage"))
  assert.ok(!sync.data.access.permissions.includes("permissions.manage"))
  for (const path of ["/orders", "/reports/monthly", "/messages", "/appointments", "/contact-emails", "/appointments/availability/settings"]) {
    assert.equal((await call(path, { token: as("admin") })).status, 200, path)
  }
  assert.equal((await call("/superadmin/users", { token: as("admin") })).status, 403)
  assert.equal((await call("/superadmin/audit", { token: as("admin") })).status, 403)
  // Self-promotion / escalation via direct API calls.
  for (const body of [{ role: "owner" }, { permission: "roles.manage", state: "grant" }, { reset: true }]) {
    assert.equal((await call(`/superadmin/users/${accounts.admin.user._id}`, { method: "PATCH", token: as("admin"), body })).status, 403)
  }
  assert.equal((await call(`/superadmin/users/${accounts.cust.user._id}`, { method: "PATCH", token: as("admin"), body: { role: "administrator" } })).status, 403)
})

test("Administrator: a single denied default permission is lost immediately, only that one", async () => {
  const order = await Order.create({ orderNumber: `E2E-${run}`, customerName: "E2E customer", customerEmail: "c@example.com", service: "PPF", specification: "x", createdBy: accounts.admin.user._id })
  await call(`/superadmin/users/${accounts.admin.user._id}`, { method: "PATCH", token: as("super"), body: { permission: "orders.approve", state: "deny" } })
  const denied = await call(`/orders/${order._id}/status`, { method: "PATCH", token: as("admin"), body: { status: "approved" } })
  assert.equal(denied.status, 403)
  const rejected = await call(`/orders/${order._id}/status`, { method: "PATCH", token: as("admin"), body: { status: "rejected" } })
  assert.equal(rejected.status, 200)
  await call(`/superadmin/users/${accounts.admin.user._id}`, { method: "PATCH", token: as("super"), body: { reset: true } })
})

test("Owner: no Super Admin center, no role/permission changes, no CMS", async () => {
  assert.equal((await call("/orders", { token: as("owner") })).status, 200)
  assert.equal((await call("/superadmin/users", { token: as("owner") })).status, 403)
  assert.equal((await call(`/superadmin/users/${accounts.cust.user._id}`, { method: "PATCH", token: as("owner"), body: { role: "moderator" } })).status, 403)
  assert.equal((await call("/site-content/e2e.key", { method: "PUT", token: as("owner"), body: { value: "x" } })).status, 403)
})

// ---------------------------------------------------------------------------
// Moderator
// ---------------------------------------------------------------------------

test("Moderator: chat visible and replyable, customer contact details redacted by the API", async () => {
  const convo = await Conversation.create({
    customer: accounts.cust.user._id,
    customerName: "E2E customer",
    customerEmail: accounts.cust.email,
    messages: [{ sender: "user", text: "Hello" }],
  })
  const list = await call("/messages", { token: as("mod") })
  assert.equal(list.status, 200)
  const row = list.data.conversations.find((c) => c._id === String(convo._id))
  assert.equal(row.customerName, "E2E customer")
  assert.equal(row.customerEmail, null)
  assert.ok(!JSON.stringify(list.data).includes(accounts.cust.email), "email leaked in list")

  const thread = await call(`/messages/${convo._id}`, { token: as("mod") })
  assert.equal(thread.data.conversation.customerEmail, null)
  assert.equal(thread.data.conversation.messages[0].text, "Hello")

  const reply = await call(`/messages/${convo._id}`, { method: "POST", token: as("mod"), body: { text: "Hi from moderator" } })
  assert.equal(reply.status, 200)
  assert.ok(!JSON.stringify(reply.data).includes(accounts.cust.email))
  assert.equal((await Conversation.findById(convo._id)).messages.at(-1).text, "Hi from moderator")

  // Admin still sees the email (same data, different permission).
  const adminList = await call("/messages", { token: as("admin") })
  assert.equal(adminList.data.conversations.find((c) => c._id === String(convo._id)).customerEmail, accounts.cust.email)
})

test("Moderator: no email inbox or sending, no finance, no customer data, no orders", async () => {
  const denied = [
    ["/contact-emails"],
    ["/contact-emails/000000000000000000000000/reply", "POST", { text: "x" }],
    ["/reports/monthly"],
    ["/invoices", "POST", {}],
    ["/invoices/by-customer?email=a@b.c"],
    ["/expenses"],
    ["/locations"],
    ["/users/customers?search=e2e"],
    ["/superadmin/users"],
  ]
  for (const [path, method = "GET", body] of denied) {
    assert.equal((await call(path, { method, token: as("mod"), body })).status, 403, `${method} ${path}`)
  }
  // Without orders.view the order list is scoped to their own (none).
  const orders = await call("/orders", { token: as("mod") })
  assert.equal(orders.status, 200)
  assert.equal(orders.data.total, 0)
})

test("Moderator: blog create / edit / publish / analytics, no delete or settings", async () => {
  const created = await call("/blog/posts", { method: "POST", token: as("mod"), body: { title: `E2E post ${run}`, content: "<p>Hello</p>", status: "draft" } })
  assert.equal(created.status, 201, JSON.stringify(created.data))
  const id = created.data.post._id
  const edited = await call(`/blog/posts/${id}`, { method: "PATCH", token: as("mod"), body: { title: `E2E post ${run} edited` } })
  assert.equal(edited.status, 200)
  const published = await call(`/blog/posts/${id}`, { method: "PATCH", token: as("mod"), body: { status: "published" } })
  assert.equal(published.data.post.status, "published")
  assert.equal((await call("/blog/admin/overview", { token: as("mod") })).status, 200)
  assert.equal((await call(`/blog/posts/${id}`, { method: "DELETE", token: as("mod") })).status, 403)
  assert.equal((await call("/blog/settings", { method: "PATCH", token: as("mod"), body: {} })).status, 403)
  assert.equal((await call("/blog/admin/comments", { token: as("mod") })).status, 403)
})

test("Moderator: appointments read-only, attendee email redacted", async () => {
  const start = new Date(Date.now() + 2 * 86400000)
  const appt = await Appointment.create({
    title: "E2E meeting",
    start,
    end: new Date(start.getTime() + 30 * 60000),
    requestedByName: "E2E customer",
    requestedByEmail: accounts.cust.email,
    requestedBy: accounts.cust.user._id,
  })
  const list = await call(`/appointments?from=${new Date(Date.now() - 86400000).toISOString()}`, { token: as("mod") })
  assert.equal(list.status, 200)
  const row = list.data.appointments.find((a) => a._id === String(appt._id))
  assert.equal(row.requestedByEmail, null)
  assert.equal(row.requestedByName, "E2E customer")
  // Probing by email is ignored for them.
  const probe = await call(`/appointments?customerEmail=${encodeURIComponent(accounts.cust.email)}`, { token: as("mod") })
  assert.ok(probe.data.appointments.length >= 1)

  assert.equal((await call("/appointments", { method: "POST", token: as("mod"), body: { title: "x", start, end: start } })).status, 403)
  // Not their booking and no appointments.cancel: denied without revealing it exists.
  assert.equal((await call(`/appointments/${appt._id}/cancel`, { method: "PATCH", token: as("mod") })).status, 404)
  assert.equal((await call("/appointments/availability/settings", { token: as("mod") })).status, 403)
  assert.equal((await call("/appointments/availability/overrides", { method: "POST", token: as("mod"), body: {} })).status, 403)
})

test("Moderator: an explicit grant opens reports; denial of a default closes chat", async () => {
  const id = accounts.mod.user._id
  await call(`/superadmin/users/${id}`, { method: "PATCH", token: as("super"), body: { permission: "reports.view", state: "grant" } })
  assert.equal((await call("/reports/monthly", { token: as("mod") })).status, 200)
  await call(`/superadmin/users/${id}`, { method: "PATCH", token: as("super"), body: { permission: "messages.view", state: "deny" } })
  assert.equal((await call("/messages", { token: as("mod") })).status, 403)
  await call(`/superadmin/users/${id}`, { method: "PATCH", token: as("super"), body: { reset: true } })
  assert.equal((await call("/reports/monthly", { token: as("mod") })).status, 403)
  assert.equal((await call("/messages", { token: as("mod") })).status, 200)
})

// ---------------------------------------------------------------------------
// Meeting attendance
// ---------------------------------------------------------------------------

test("Meeting: Join records joinedAt → joined; no Join → missed; page loads never count", async () => {
  const now = Date.now()
  const base = { requestedByName: "E2E customer", requestedByEmail: accounts.cust.email, requestedBy: accounts.cust.user._id }
  const live = await Appointment.create({ ...base, title: "live", start: new Date(now - 5 * 60000), end: new Date(now + 25 * 60000) })
  const past = await Appointment.create({ ...base, title: "past", start: new Date(now - 90 * 60000), end: new Date(now - 60 * 60000) })
  const future = await Appointment.create({ ...base, title: "future", start: new Date(now + 3 * 3600000), end: new Date(now + 3.5 * 3600000) })

  // Loading the list (twice, like a refresh) never marks anything joined.
  await call("/appointments/mine", { token: as("cust") })
  const before = await call("/appointments/mine", { token: as("cust") })
  const statusOf = (data, id) => data.appointments.find((a) => a._id === String(id))?.attendanceStatus
  assert.equal(statusOf(before.data, live._id), "scheduled")
  assert.equal(statusOf(before.data, past._id), "missed")
  assert.equal((await Appointment.findById(live._id)).joinedAt, null)

  const join = await call(`/appointments/${live._id}/join`, { method: "PATCH", token: as("cust") })
  assert.equal(join.status, 200)
  assert.equal(join.data.appointment.attendanceStatus, "joined")
  const stored = await Appointment.findById(live._id)
  assert.ok(stored.joinedAt)
  assert.equal(stored.joinClicked, true)
  // A second click keeps the first joinedAt.
  await call(`/appointments/${live._id}/join`, { method: "PATCH", token: as("cust") })
  assert.equal((await Appointment.findById(live._id)).joinedAt.getTime(), stored.joinedAt.getTime())

  assert.equal((await call(`/appointments/${future._id}/join`, { method: "PATCH", token: as("cust") })).data.code, "MEETING_NOT_STARTED")
  assert.equal((await call(`/appointments/${past._id}/join`, { method: "PATCH", token: as("cust") })).data.code, "MEETING_ENDED")
  // Someone else's meeting (a plain customer): not found.
  await call(`/superadmin/users/${accounts.target.user._id}`, { method: "PATCH", token: as("super"), body: { role: "customer" } })
  assert.equal((await call(`/appointments/${live._id}/join`, { method: "PATCH", token: as("target") })).status, 404)
  // A staff host may join a customer's meeting, but it isn't the customer's attendance.
  const hostMeeting = await Appointment.create({ ...base, title: "host", start: new Date(now - 60000), end: new Date(now + 29 * 60000) })
  const hostJoin = await call(`/appointments/${hostMeeting._id}/join`, { method: "PATCH", token: as("admin") })
  assert.equal(hostJoin.status, 200)
  assert.equal(hostJoin.data.recorded, false)
  assert.equal((await Appointment.findById(hostMeeting._id)).joinedAt, null)

  const after = await call("/appointments/mine", { token: as("cust") })
  assert.equal(statusOf(after.data, live._id), "joined")
  assert.equal(statusOf(after.data, past._id), "missed")
  // Staff see the same status.
  const staff = await call(`/appointments?from=${new Date(now - 86400000).toISOString()}`, { token: as("admin") })
  assert.equal(staff.data.appointments.find((a) => a._id === String(live._id)).attendanceStatus, "joined")
  assert.equal(staff.data.appointments.find((a) => a._id === String(past._id)).attendanceStatus, "missed")
})

// ---------------------------------------------------------------------------
// Email/password registration
// ---------------------------------------------------------------------------

test("Signup: mismatched passwords never send a link; taken email refused", async () => {
  const mismatch = await call("/auth/signup", { method: "POST", body: { name: "X", email: emailFor("new"), password: "abcdef1", confirmPassword: "abcdef2" } })
  assert.equal(mismatch.status, 400)
  assert.equal(mismatch.data.error, "Passwords do not match")
  assert.equal(await PendingSignup.countDocuments({ email: emailFor("new") }), 0)
  const taken = await call("/auth/signup", { method: "POST", body: { name: "X", email: accounts.cust.email, password: "abcdef1", confirmPassword: "abcdef1" } })
  assert.equal(taken.status, 409)
})

test("Signup: send failure leaves nothing behind (SMTP unreachable in this test)", async () => {
  const r = await call("/auth/signup", { method: "POST", body: { name: "X", email: emailFor("smtp"), password: "abcdef1", confirmPassword: "abcdef1" } })
  assert.equal(r.status, 502)
  assert.equal(await PendingSignup.countDocuments({ email: emailFor("smtp") }), 0)
})

test("Signup: verified link creates exactly one account; reuse, bad key; verified login needs no re-verification", async () => {
  // Stand-in for the emailed link (the email step itself is covered above).
  const email = emailFor("signup")
  const { key, iv, tag, ciphertext } = encryptPassword(PASSWORD)
  const pending = await PendingSignup.create({ email, name: "Signup Name", iv, tag, ciphertext, keyHash: hashKey(key) })
  const token = buildToken(String(pending._id), key)

  // Nothing exists in Firebase before the link is opened.
  await assert.rejects(firebase("signInWithPassword", { email, password: PASSWORD, returnSecureToken: true }))

  const bad = await call("/auth/signup/verify", { method: "POST", body: { token: buildToken(String(pending._id), encryptPassword("x").key) } })
  assert.equal(bad.status, 400)
  assert.ok(!JSON.stringify(bad.data).includes(email), "email revealed without the key")

  const ok = await call("/auth/signup/verify", { method: "POST", body: { token } })
  assert.equal(ok.status, 200, JSON.stringify(ok.data))
  assert.equal(ok.data.email, email)
  const again = await call("/auth/signup/verify", { method: "POST", body: { token } })
  assert.equal(again.data.alreadyVerified, true)

  const signIn = await firebase("signInWithPassword", { email, password: PASSWORD, returnSecureToken: true })
  createdTokens.push(signIn.idToken)
  const users = await User.find({ email }).lean()
  assert.equal(users.length, 1, "duplicate users")
  assert.equal(users[0].emailVerified, true)
  assert.equal(users[0].name, "Signup Name")

  // Normal login: straight in, no verification step, still one user.
  const sync = await call("/auth/sync", { method: "POST", token: signIn.idToken, body: { name: "" } })
  assert.equal(sync.status, 200)
  assert.equal(sync.data.user.name, "Signup Name")
  await call("/auth/sync", { method: "POST", token: signIn.idToken, body: {} })
  assert.equal(await User.countDocuments({ email }), 1)
  assert.equal((await PendingSignup.findById(pending._id)).ciphertext, "")
})

test("Signup: an unconfirmed password account gets no profile and no access", async () => {
  const email = emailFor("unverified")
  const { idToken } = await firebase("signUp", { email, password: PASSWORD, returnSecureToken: true })
  createdTokens.push(idToken)
  const r = await call("/auth/sync", { method: "POST", token: idToken, body: {} })
  assert.equal(r.status, 403)
  assert.equal(r.data.error, "Email not verified")
  assert.equal(await User.countDocuments({ email }), 0)
  assert.equal((await call("/orders", { token: idToken })).status, 403)
})

test("Unauthenticated calls are refused", async () => {
  for (const path of ["/superadmin/users", "/messages", "/appointments", "/auth/me"]) {
    assert.equal((await call(path)).status, 401, path)
  }
})

// ---------------------------------------------------------------------------
// Meeting link privacy, join time, reschedule / cancel
// ---------------------------------------------------------------------------

const leaks = (data) => JSON.stringify(data ?? "").includes(MEET)
const day3 = addDays(getNorwayNow().date, 3)
const day4 = addDays(getNorwayNow().date, 4)
let bookedId

test("Booking: the meeting link appears nowhere before the meeting", async () => {
  const booked = await call("/appointments/request", { method: "POST", token: as("cust"), body: { title: "E2E booking", date: day3, time: "10:00", durationMinutes: 30 } })
  assert.equal(booked.status, 201, JSON.stringify(booked.data))
  assert.ok(!leaks(booked.data), "link in booking response")
  bookedId = booked.data.appointment._id
  // Stored server-side…
  assert.equal((await Appointment.findById(bookedId).select("+meetingUrl")).meetingUrl, MEET)
  // …but never in lists.
  assert.ok(!leaks((await call("/appointments/mine", { token: as("cust") })).data), "link in customer list")
  assert.ok(!leaks((await call(`/appointments?from=${new Date(Date.now() - 864e5).toISOString()}`, { token: as("admin") })).data), "link in staff list")
  // Join before the start: refused, no link.
  const early = await call(`/appointments/${bookedId}/join`, { method: "PATCH", token: as("cust") })
  assert.equal(early.data.code, "MEETING_NOT_STARTED")
  assert.ok(!leaks(early.data))
  // The staff room endpoint is staff-only.
  assert.equal((await call("/appointments/meeting-room", { token: as("cust") })).status, 403)
  const room = await call("/appointments/meeting-room", { token: as("admin") })
  assert.equal(room.data.meetingUrl, MEET)
})

test("Join: link released only at meeting time (server clock), with joinedAt", async () => {
  const base = { requestedByName: "E2E customer", requestedByEmail: accounts.cust.email, requestedBy: accounts.cust.user._id, meetingUrl: MEET }
  const now = Date.now()
  const soon = await Appointment.create({ ...base, title: "soon", start: new Date(now + 5 * 60000), end: new Date(now + 35 * 60000) })
  const live = await Appointment.create({ ...base, title: "live2", start: new Date(now - 60000), end: new Date(now + 29 * 60000) })

  const custEarly = await call(`/appointments/${soon._id}/join`, { method: "PATCH", token: as("cust") })
  assert.equal(custEarly.data.code, "MEETING_NOT_STARTED")
  assert.ok(!leaks(custEarly.data))
  // Staff hosts may open it 15 minutes early (not the customer's attendance).
  const hostEarly = await call(`/appointments/${soon._id}/join`, { method: "PATCH", token: as("admin") })
  assert.equal(hostEarly.data.meetingUrl, MEET)
  assert.equal(hostEarly.data.recorded, false)

  const join = await call(`/appointments/${live._id}/join`, { method: "PATCH", token: as("cust") })
  assert.equal(join.status, 200)
  assert.equal(join.data.meetingUrl, MEET)
  assert.equal(join.data.appointment.attendanceStatus, "joined")
  assert.ok((await Appointment.findById(live._id)).joinedAt)
})

test("Reschedule: customer ≥1 h before succeeds (same appointment), <1 h rejected, staff any time, no double booking", async () => {
  const before = await Appointment.countDocuments({ requestedBy: accounts.cust.user._id })
  const moved = await call(`/appointments/${bookedId}/reschedule`, { method: "POST", token: as("cust"), body: { date: day3, time: "11:00" } })
  assert.equal(moved.status, 200, JSON.stringify(moved.data))
  assert.equal(moved.data.appointment._id, bookedId)
  assert.equal(new Date(moved.data.appointment.start).toISOString(), osloToUtc(day3, "11:00").toISOString())
  assert.equal(await Appointment.countDocuments({ requestedBy: accounts.cust.user._id }), before, "duplicate created")
  const slots = (await call(`/appointments/availability?date=${day3}`)).data.slots
  assert.equal(slots.find((x) => x.time === "10:00").available, true, "old slot not freed")
  assert.equal(slots.find((x) => x.time === "11:00").reason, "already_booked")
  assert.ok(!leaks(moved.data))

  const base = { requestedByName: "E2E customer", requestedByEmail: accounts.cust.email, requestedBy: accounts.cust.user._id }
  const now = Date.now()
  const close = await Appointment.create({ ...base, title: "in 30 min", start: new Date(now + 30 * 60000), end: new Date(now + 60 * 60000) })
  const late = await call(`/appointments/${close._id}/reschedule`, { method: "POST", token: as("cust"), body: { date: day4, time: "09:00" } })
  assert.equal(late.status, 409)
  assert.equal(late.data.code, "RESCHEDULE_CLOSED")
  assert.equal((await Appointment.findById(close._id)).start.getTime(), close.start.getTime())

  const staff = await call(`/appointments/${close._id}/reschedule`, { method: "POST", token: as("admin"), body: { date: day4, time: "09:00" } })
  assert.equal(staff.status, 200, JSON.stringify(staff.data))
  assert.equal(new Date(staff.data.appointment.start).toISOString(), osloToUtc(day4, "09:00").toISOString())

  // The customer can't move into a slot someone else now holds.
  const clash = await call(`/appointments/${bookedId}/reschedule`, { method: "POST", token: as("cust"), body: { date: day4, time: "09:00" } })
  assert.equal(clash.data.code, "SLOT_UNAVAILABLE")
  // Moderators (no appointments.reschedule) can't.
  assert.equal((await call(`/appointments/${bookedId}/reschedule`, { method: "POST", token: as("mod"), body: { date: day4, time: "12:00" } })).status, 404)
})

test("Cancel: customer before start only; staff per permission; slot freed", async () => {
  const base = { requestedByName: "E2E customer", requestedByEmail: accounts.cust.email, requestedBy: accounts.cust.user._id }
  const now = Date.now()
  const started = await Appointment.create({ ...base, title: "started", start: new Date(now - 5 * 60000), end: new Date(now + 25 * 60000) })
  const lateCancel = await call(`/appointments/${started._id}/cancel`, { method: "PATCH", token: as("cust") })
  assert.equal(lateCancel.data.code, "CANCEL_CLOSED")
  assert.equal((await call(`/appointments/${bookedId}/cancel`, { method: "PATCH", token: as("mod") })).status, 404)

  const ok = await call(`/appointments/${bookedId}/cancel`, { method: "PATCH", token: as("cust") })
  assert.equal(ok.status, 200)
  assert.equal(ok.data.appointment.status, "cancelled")
  const slots = (await call(`/appointments/availability?date=${day3}`)).data.slots
  assert.equal(slots.find((x) => x.time === "11:00").available, true, "cancelled slot not freed")
  assert.equal((await call(`/appointments/${started._id}/cancel`, { method: "PATCH", token: as("admin") })).status, 200)
})

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

test("Invoice: UNPAID → DUE → PAID via payments; OVERDUE preserved; same status for customer", async () => {
  const mk = (o) =>
    Invoice.create({
      invoiceNumber: `E2E-${run}-${crypto.randomBytes(2).toString("hex")}`,
      orderNumber: "E2E",
      customerId: accounts.cust.user._id,
      customer: { name: "E2E customer", email: accounts.cust.email },
      dueDate: new Date(Date.now() + 14 * 864e5),
      items: [{ name: "Service", quantity: 1, unitPrice: 8000, vatRate: 25, subtotal: 8000 }],
      subtotal: 8000,
      vatAmount: 2000,
      grandTotal: 10000,
      createdBy: accounts.admin.user._id,
      ...o,
    })
  const inv = await mk({})
  const get = async (who) => (await call(`/invoices/${inv._id}`, { token: as(who) })).data.invoice
  assert.equal((await get("cust")).status, "unpaid")

  let r = await call(`/invoices/${inv._id}/payment`, { method: "PATCH", token: as("admin"), body: { addPayment: 3000 } })
  assert.equal(r.data.invoice.status, "partially_paid")
  assert.equal(r.data.invoice.balanceDue, 7000)
  assert.equal((await get("cust")).status, "partially_paid")
  assert.equal((await Invoice.findById(inv._id)).status, "partially_paid", "stored status")

  // The client can't set a status that contradicts the amounts.
  r = await call(`/invoices/${inv._id}/payment`, { method: "PATCH", token: as("admin"), body: { status: "overdue" } })
  assert.equal(r.status, 400)

  r = await call(`/invoices/${inv._id}/payment`, { method: "PATCH", token: as("admin"), body: { addPayment: 7000 } })
  assert.equal(r.data.invoice.status, "paid")
  assert.ok((await Invoice.findById(inv._id)).paidAt)

  const overdue = await mk({ amountPaid: 3000, status: "partially_paid", dueDate: new Date(Date.now() - 3 * 864e5) })
  assert.equal((await call(`/invoices/${overdue._id}`, { token: as("cust") })).data.invoice.status, "overdue")

  assert.equal((await call(`/invoices/${inv._id}/payment`, { method: "PATCH", token: as("mod"), body: { addPayment: 1 } })).status, 403)
  assert.equal((await call(`/invoices/${inv._id}/payment`, { method: "PATCH", token: as("cust"), body: { addPayment: 1 } })).status, 403)

  // Sending builds the full invoice email; SMTP is unreachable in this test,
  // so the route reports delivered: false but still records the send.
  const sent = await call(`/invoices/${overdue._id}/send`, { method: "POST", token: as("admin") })
  assert.equal(sent.status, 200)
  assert.equal(sent.data.delivered, false)
  assert.equal(sent.data.invoice.status, "overdue")
})

// ---------------------------------------------------------------------------
// Notes & reminders
// ---------------------------------------------------------------------------

const { Note } = await import("../lib/models/Note.js")
const { Order: OrderModel } = await import("../lib/models/Order.js")
const { Expense } = await import("../lib/models/Expense.js")
const { Notification: NotificationModel } = await import("../lib/models/Notification.js")
const cron = (secret = CRON_SECRET) =>
  fetch(`${BASE}/api/notes/reminders/run`, { method: "POST", headers: secret ? { Authorization: `Bearer ${secret}` } : {} }).then(async (r) => ({ status: r.status, data: await r.json().catch(() => null) }))
const future = (minutes) => {
  const at = new Date(Date.now() + minutes * 60000)
  return at.toISOString()
}
const mkNote = (who, body) => call("/notes", { method: "POST", token: as(who), body })
const records = {}

test("Notes: owner, administrator and Super Admin create notes; moderator and customer can't", async () => {
  // The target account was left as a plain customer by earlier tests.
  for (const who of ["owner", "admin", "super"]) {
    const r = await mkNote(who, { title: `General note by ${who}`, content: "Quick thought" })
    assert.equal(r.status, 201, `${who}: ${JSON.stringify(r.data)}`)
    assert.equal(r.data.note.related, null)
  }
  for (const who of ["mod", "cust"]) assert.equal((await mkNote(who, { title: "x" })).status, 403, `${who} create`)
  // Moderators open Notes only to read what's shared with them — nothing else.
  const modList = await call("/notes", { token: as("mod") })
  assert.equal(modList.status, 200)
  assert.equal(modList.data.notes.length, 0, "no one else's private notes")
  assert.equal((await call("/notes?q=general", { token: as("mod") })).data.notes.length, 0, "search finds nothing private")
  for (const path of ["/notes", "/notes?q=general"]) assert.equal((await call(path, { token: as("cust") })).status, 403, `cust ${path}`)
  assert.equal((await call("/notes")).status, 401)
  // The old combined key no longer exists; notes powers never reach customers.
  const grant = await call(`/superadmin/users/${accounts.mod.user._id}`, { method: "PATCH", token: as("super"), body: { permission: "notes.use", state: "grant" } })
  assert.equal(grant.status, 400)
  assert.equal((await call(`/superadmin/users/${accounts.cust.user._id}`, { method: "PATCH", token: as("super"), body: { permission: "notes.view", state: "grant" } })).status, 400)
  const modAccess = (await call("/auth/me", { token: as("mod") })).data.access.permissions
  assert.deepEqual(modAccess.filter((p) => p.startsWith("notes.")), ["notes.view", "notes.edit"])
})

test("Notes: contextual notes on an order, meeting, invoice and expense (label from the server)", async () => {
  records.order = await OrderModel.create({ orderNumber: `N-${run}`, customerName: "Matte Kunde AS", customerEmail: accounts.cust.email, customerId: accounts.cust.user._id, service: "Packaging", specification: "x", createdBy: accounts.admin.user._id })
  records.appointment = await Appointment.create({ title: "Befaring", start: new Date(Date.now() + 864e5), end: new Date(Date.now() + 864e5 + 1800000), requestedByName: "ABC AS", requestedByEmail: accounts.cust.email, requestedBy: accounts.cust.user._id })
  records.invoice = await Invoice.create({ invoiceNumber: `INV-N-${run}`, orderNumber: `N-${run}`, customerId: accounts.cust.user._id, customer: { name: "Matte Kunde AS", email: accounts.cust.email }, dueDate: new Date(Date.now() + 14 * 864e5), items: [], subtotal: 0, vatAmount: 0, grandTotal: 1000, createdBy: accounts.admin.user._id })
  records.expense = await Expense.create({ amount: 499, category: "materials", date: new Date(), note: "Vinyl", createdBy: accounts.admin.user._id })

  const expected = { order: `#N-${run} — Matte Kunde AS`, appointment: "Befaring — ABC AS", invoice: `INV-N-${run} — Matte Kunde AS`, expense: "materials · 499 kr" }
  for (const type of ["order", "appointment", "invoice", "expense"]) {
    const r = await mkNote("admin", { title: `Note on ${type}`, content: `Secret internal remark ${run}`, relatedEntityType: type, relatedEntityId: String(records[type]._id), relatedEntityLabel: "FORGED" })
    assert.equal(r.status, 201, `${type}: ${JSON.stringify(r.data)}`)
    assert.equal(r.data.note.related.type, type)
    assert.ok(r.data.note.related.label.startsWith(expected[type]), `${type} label: ${r.data.note.related.label}`)
    records[`${type}Note`] = r.data.note
  }
  // "Notes for this record" count.
  const count = (who) => call(`/notes?countOnly=1&relatedType=order&relatedId=${records.order._id}`, { token: as(who) })
  assert.equal((await count("admin")).data.total, 1)
  assert.equal((await count("owner")).data.total, 0, "someone else's private note isn't counted")
  // Unknown record / type are refused.
  assert.equal((await mkNote("admin", { title: "x", relatedEntityType: "order", relatedEntityId: "000000000000000000000000" })).status, 404)
  assert.equal((await mkNote("admin", { title: "x", relatedEntityType: "users", relatedEntityId: "1" })).status, 400)
  // Never in any customer-facing response.
  const leak = (d) => JSON.stringify(d).includes(`Secret internal remark ${run}`)
  assert.ok(!leak((await call(`/orders/${records.order._id}`, { token: as("cust") })).data))
  assert.ok(!leak((await call("/orders", { token: as("cust") })).data))
  assert.ok(!leak((await call(`/invoices/${records.invoice._id}`, { token: as("cust") })).data))
  assert.ok(!leak((await call("/appointments/mine", { token: as("cust") })).data))
})

test("Notes: edit, pin, archive, complete and delete (with delete rights)", async () => {
  const id = records.orderNote._id
  assert.equal((await call(`/notes/${id}`, { method: "PATCH", token: as("owner"), body: { title: "Hijack" } })).status, 404, "private: not even visible")
  let r = await call(`/notes/${id}`, { method: "PATCH", token: as("admin"), body: { title: "Edited title", tags: [" payment ", "Payment", "urgent"] } })
  assert.equal(r.data.note.title, "Edited title")
  assert.deepEqual(r.data.note.tags, ["payment", "urgent"])
  assert.equal(r.data.note.related.type, "order", "relationship kept")
  r = await call(`/notes/${id}`, { method: "PATCH", token: as("admin"), body: { isPinned: true } })
  assert.equal(r.data.note.isPinned, true)
  const pinned = await call("/notes?filter=pinned", { token: as("admin") })
  assert.ok(pinned.data.notes.some((n) => n._id === id))
  r = await call(`/notes/${id}`, { method: "PATCH", token: as("admin"), body: { isCompleted: true } })
  assert.ok(r.data.note.isCompleted && r.data.note.completedAt)
  r = await call(`/notes/${id}`, { method: "PATCH", token: as("admin"), body: { archived: true } })
  assert.equal(r.data.note.archived, true)
  assert.ok(!(await call("/notes", { token: as("admin") })).data.notes.some((n) => n._id === id), "archived hidden from All")
  assert.ok((await call("/notes?filter=archived", { token: as("admin") })).data.notes.some((n) => n._id === id))

  // Delete: only the creator.
  const ownersNote = (await mkNote("owner", { title: "Owner's own" })).data.note
  assert.equal((await call(`/notes/${ownersNote._id}`, { method: "DELETE", token: as("admin") })).status, 404)
  assert.equal((await call(`/notes/${ownersNote._id}`, { method: "DELETE", token: as("owner") })).status, 204)
  assert.equal((await call(`/notes/${ownersNote._id}`, { token: as("owner") })).status, 404)
  assert.equal((await call(`/notes/${records.expenseNote._id}`, { method: "DELETE", token: as("super") })).status, 404, "Super Admin doesn't see private notes")
  assert.equal((await call(`/notes/${records.expenseNote._id}`, { method: "DELETE", token: as("admin") })).status, 204)
  assert.equal((await call("/notes/not-an-id", { token: as("admin") })).status, 404)
})

test("Notes: checklist items can be added, edited, removed and completed", async () => {
  let r = await mkNote("admin", { type: "checklist", title: "Production run", checklistItems: [{ text: "Order vinyl" }, { text: "Print labels" }, { text: "  " }] })
  assert.equal(r.status, 201)
  let note = r.data.note
  assert.equal(note.checklistItems.length, 2, "blank items dropped")
  const [a, b] = note.checklistItems
  r = await call(`/notes/${note._id}`, { method: "PATCH", token: as("admin"), body: { checklistItems: [{ ...a, completed: true }, { ...b, text: "Print matte labels" }, { text: "Ship boxes" }] } })
  note = r.data.note
  assert.deepEqual(note.progress, { done: 1, total: 3 })
  assert.equal(note.checklistItems[0]._id, a._id, "item ids kept")
  assert.equal(note.isCompleted, false)
  r = await call(`/notes/${note._id}`, { method: "PATCH", token: as("admin"), body: { checklistItems: note.checklistItems.map((i) => ({ ...i, completed: true })) } })
  assert.equal(r.data.note.isCompleted, true, "all done → completed")
  r = await call(`/notes/${note._id}`, { method: "PATCH", token: as("admin"), body: { checklistItems: r.data.note.checklistItems.slice(1) } })
  assert.equal(r.data.note.checklistItems.length, 2)
  records.checklistNote = r.data.note
})

test("Notes: search by title, content word, checklist text, tag and related record", async () => {
  await mkNote("owner", { title: `Supplier ${run}`, content: "Call customer regarding matte black packaging", tags: ["urgent", "customer follow-up"] })
  const find = async (q, extra = "", who = "admin") => (await call(`/notes?q=${encodeURIComponent(q)}${extra}`, { token: as(who) })).data.notes.map((n) => n.title)
  assert.ok((await find(`Supplier ${run}`, "", "owner")).includes(`Supplier ${run}`), "title")
  for (const q of ["matte", "customer packaging", "packag", "urgent", "follow-up"]) assert.ok((await find(q, "", "owner")).includes(`Supplier ${run}`), q)
  assert.ok(!(await find(`Supplier ${run}`)).length, "another user's private note never shows up in search")
  assert.ok((await find("matte labels")).includes("Production run"), "checklist text")
  assert.ok((await find("Befaring")).includes("Note on appointment"), "related label")
  assert.ok((await find(`INV-N-${run}`)).includes("Note on invoice"), "related invoice number")
  assert.deepEqual(await find("zzzznotthere"), [])
  // Search also reaches archived notes.
  assert.ok((await find("Edited title", "&filter=archived")).includes("Edited title"))
})

test("Reminders: one-time email reminder sends exactly once; notes without reminders never send", async () => {
  const plainNote = (await mkNote("admin", { title: "No reminder here" })).data.note
  assert.equal(plainNote.reminder.enabled, false)
  assert.equal(plainNote.reminder.nextAt, null)

  const r = await mkNote("admin", { title: `Email me ${run}`, content: "Pay supplier", reminder: { enabled: true, at: future(5), email: true } })
  assert.equal(r.status, 201, JSON.stringify(r.data))
  const id = r.data.note._id
  assert.ok(r.data.note.reminder.nextAt)
  // Not due yet → nothing.
  let run1 = await cron()
  assert.equal(run1.status, 200)
  assert.ok(!run1.data.sent.some((s) => s.id === id))
  // Time passes (simulated): due now.
  await Note.updateOne({ _id: id }, { $set: { "reminder.nextAt": new Date(Date.now() - 1000) } })
  // Two runners at once → still one delivery.
  const [a, b] = await Promise.all([cron(), cron()])
  const deliveries = [...a.data.sent, ...b.data.sent].filter((s) => s.id === id)
  assert.equal(deliveries.length, 1, "delivered once")
  assert.equal(deliveries[0].email, true, "email attempted (SMTP is unreachable in this test)")
  const again = await cron()
  assert.ok(!again.data.sent.some((s) => s.id === id), "not sent again")
  const stored = await Note.findById(id).lean()
  assert.equal(stored.reminder.sentCount, 1)
  assert.equal(stored.reminder.nextAt, null, "one-time reminder finished")
  assert.ok(stored.reminder.lastSentAt)
  assert.ok(await NotificationModel.exists({ user: accounts.admin.user._id, type: "note_reminder", "data.noteId": id }), "in-app notification")
  assert.ok(![...a.data.sent, ...b.data.sent, ...again.data.sent].some((s) => s.id === String(plainNote._id)))

  // In-app only when email is off.
  const quiet = (await mkNote("admin", { title: "In-app only", reminder: { enabled: true, at: future(5), email: false } })).data.note
  await Note.updateOne({ _id: quiet._id }, { $set: { "reminder.nextAt": new Date(Date.now() - 1000) } })
  const q = (await cron()).data.sent.find((s) => s.id === quiet._id)
  assert.equal(q.email, false)

  // The cron route needs the secret (or the signed-in Super Admin).
  assert.equal((await cron(null)).status, 401)
  assert.equal((await cron("wrong-secret-wrong-secret")).status, 401)
  assert.equal((await call("/notes/reminders/run", { method: "POST", token: as("admin") })).status, 403)
  assert.equal((await call("/notes/reminders/run", { method: "POST", token: as("super") })).status, 200)
})

test("Reminders: recurring reminder moves to its next occurrence", async () => {
  const at = new Date(Date.now() + 10 * 60000)
  const r = await mkNote("owner", { title: "Weekly check", reminder: { enabled: true, at: at.toISOString(), recurrence: "daily", email: false } })
  const id = r.data.note._id
  // Fire it as if the first occurrence has arrived.
  await Note.updateOne({ _id: id }, { $set: { "reminder.nextAt": new Date(Date.now() - 1000), "reminder.at": new Date(Date.now() - 1000 - 864e5) } })
  const res = await cron()
  const sent = res.data.sent.find((s) => s.id === id)
  assert.ok(sent, "fired")
  const stored = await Note.findById(id).lean()
  assert.ok(stored.reminder.nextAt > new Date(), "next occurrence in the future")
  assert.ok(stored.reminder.nextAt - new Date() <= 864e5, "within a day (daily)")
  assert.equal(stored.reminder.sentCount, 1)
})

test("Reminders: 'remind again if unfinished' follows up, and stops once completed", async () => {
  const r = await mkNote("admin", { type: "checklist", title: "Unfinished task", checklistItems: [{ text: "Step 1" }], reminder: { enabled: true, at: future(5), onlyIfUnfinished: true, followUpHours: 3 } })
  const id = r.data.note._id
  await Note.updateOne({ _id: id }, { $set: { "reminder.nextAt": new Date(Date.now() - 1000) } })
  assert.ok((await cron()).data.sent.some((s) => s.id === id))
  let stored = await Note.findById(id).lean()
  const hoursAhead = (stored.reminder.nextAt - Date.now()) / 3600000
  assert.ok(hoursAhead > 2.9 && hoursAhead <= 3, `follow-up in ~3 h, got ${hoursAhead}`)
  // Completed → the follow-up is dropped, not sent.
  await call(`/notes/${id}`, { method: "PATCH", token: as("admin"), body: { isCompleted: true } })
  await Note.updateOne({ _id: id }, { $set: { "reminder.nextAt": new Date(Date.now() - 1000) } })
  assert.ok(!(await cron()).data.sent.some((s) => s.id === id))
  stored = await Note.findById(id).lean()
  assert.equal(stored.reminder.nextAt, null)
  assert.equal(stored.reminder.sentCount, 1)
})

test("Notes: expiry archives (never deletes); validation refuses bad input", async () => {
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10)
  const r = await mkNote("admin", { title: `Expiring ${run}`, expiresAt: { date: tomorrow } })
  assert.equal(r.status, 201)
  const id = r.data.note._id
  await Note.updateOne({ _id: id }, { $set: { expiresAt: new Date(Date.now() - 1000) } })
  const list = await call("/notes", { token: as("admin") })
  assert.ok(!list.data.notes.some((n) => n._id === id), "moved out of All")
  const stored = await Note.findById(id).lean()
  assert.equal(stored.archived, true)
  assert.equal(stored.archiveReason, "expired")
  assert.ok((await call("/notes?filter=archived", { token: as("admin") })).data.notes.some((n) => n._id === id))
  assert.ok((await call(`/notes?filter=archived&q=${encodeURIComponent(`Expiring ${run}`)}`, { token: as("admin") })).data.notes.some((n) => n._id === id), "found in the archive")

  assert.equal((await mkNote("admin", { title: "x", reminder: { enabled: true, at: new Date(Date.now() - 60000).toISOString() } })).status, 400, "past one-time reminder")
  assert.equal((await mkNote("admin", { title: "x", expiresAt: { date: "2020-01-01" } })).status, 400, "past expiry")
  assert.equal((await mkNote("admin", { type: "poem", title: "x" })).status, 400)
  assert.equal((await mkNote("admin", {})).status, 400, "empty note")
  assert.equal((await mkNote("admin", { title: "x", reminder: { enabled: true } })).status, 400, "reminder without time")
})

test("Notes: private attachments and voice notes", async () => {
  const note = (await mkNote("admin", { title: "With files" })).data.note
  const upload = async (who, bytes, name, kind = "file") => {
    const form = new FormData()
    form.append("file", new Blob([bytes], { type: kind === "voice" ? "audio/webm" : "application/octet-stream" }), name)
    form.append("kind", kind)
    if (kind === "voice") form.append("durationSec", "4")
    const res = await fetch(`${BASE}/api/notes/${note._id}/attachments`, { method: "POST", headers: { Authorization: `Bearer ${as(who)}` }, body: form })
    return { status: res.status, data: await res.json().catch(() => null) }
  }
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])
  let r = await upload("admin", png, "screenshot.png")
  assert.equal(r.status, 201, JSON.stringify(r.data))
  const att = r.data.note.attachments[0]
  assert.equal(att.mimeType, "image/png")
  assert.ok(!JSON.stringify(r.data).includes("storedName"), "storage name never leaves the server")
  assert.equal((await upload("admin", Buffer.from("MZ\x90\x00 evil"), "invoice.pdf")).status, 400, "disguised exe")
  assert.equal((await upload("admin", Buffer.from("MZ"), "tool.exe")).status, 400)
  assert.equal((await upload("mod", png, "x.png")).status, 404, "a moderator can't even see someone's private note")
  assert.equal((await upload("cust", png, "x.png")).status, 403)

  // Private: another owner can't fetch it; the creator can.
  assert.equal((await fetch(`${BASE}/api/notes/${note._id}/attachments/${att._id}`, { headers: { Authorization: `Bearer ${as("owner")}` } })).status, 404)
  const dl = await fetch(`${BASE}/api/notes/${note._id}/attachments/${att._id}`, { headers: { Authorization: `Bearer ${as("admin")}` } })
  assert.equal(dl.status, 200)
  assert.equal(dl.headers.get("content-type"), "image/png")
  assert.equal(dl.headers.get("x-content-type-options"), "nosniff")
  assert.deepEqual(Buffer.from(await dl.arrayBuffer()), png)
  assert.equal((await fetch(`${BASE}/api/notes/${note._id}/attachments/${att._id}`)).status, 401)
  assert.equal((await fetch(`${BASE}/api/notes/${note._id}/attachments/${att._id}`, { headers: { Authorization: `Bearer ${as("cust")}` } })).status, 403)
  // Not reachable through the public uploads path either.
  assert.equal((await fetch(`${BASE}/uploads/screenshot.png`)).status, 404)

  const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01])
  r = await upload("admin", webm, "blob", "voice")
  assert.equal(r.status, 201, JSON.stringify(r.data))
  assert.equal(r.data.note.voiceNote.durationSec, 4)
  const voice = await fetch(`${BASE}/api/notes/${note._id}/attachments/voice`, { headers: { Authorization: `Bearer ${as("admin")}` } })
  assert.equal(voice.headers.get("content-type"), "audio/webm")

  // Shared with owners (even with editing allowed): they can open the files,
  // not add or remove them.
  await call(`/notes/${note._id}`, { method: "PATCH", token: as("admin"), body: { sharing: { roles: ["owner"], allowEditing: true } } })
  assert.equal((await fetch(`${BASE}/api/notes/${note._id}/attachments/${att._id}`, { headers: { Authorization: `Bearer ${as("owner")}` } })).status, 200)
  assert.equal((await upload("owner", png, "x.png")).status, 403)
  assert.equal((await call(`/notes/${note._id}/attachments/${att._id}`, { method: "DELETE", token: as("owner") })).status, 403)

  const files = () => fs.readdirSync(path.join(PRIVATE_DIR, "notes")).length
  const before = files()
  r = await call(`/notes/${note._id}/attachments/${att._id}`, { method: "DELETE", token: as("admin") })
  assert.equal(r.data.note.attachments.length, 0)
  assert.equal(files(), before - 1, "file removed from storage")
  assert.equal((await call(`/notes/${note._id}`, { method: "DELETE", token: as("admin") })).status, 204)
  assert.equal(files(), before - 2, "voice note removed with the note")
})

// Privacy scenarios (Notes redesign): private by default, one sharing group
// at a time, reminders follow exactly the same audience.
const fireNow = async (id) => {
  await Note.updateOne({ _id: id }, { $set: { "reminder.nextAt": new Date(Date.now() - 1000) } })
  const res = await cron()
  return res.data.sent.find((s) => s.id === String(id))
}
const ids = (...labels) => labels.map((l) => String(accounts[l].user._id)).sort()
const reached = (sent) => sent.recipients.map((x) => x.user).sort()
const sees = async (who, id) => (await call(`/notes/${id}`, { token: as(who) })).status
const listed = async (who, id, qs = "") => (await call(`/notes?limit=50${qs}`, { token: as(who) })).data.notes.some((n) => n._id === String(id))

test("Scenario 1 + 10: an owner's private note — only that owner sees it and gets its reminder", async () => {
  const note = (await mkNote("owner", { title: `Owner private ${run}`, content: "Only mine", reminder: { enabled: true, at: future(10), email: true } })).data.note
  assert.equal(note.sharedWith, "private", "private by default")
  assert.equal(await sees("owner", note._id), 200)
  for (const who of ["owner2", "admin", "admin2", "super"]) {
    assert.equal(await sees(who, note._id), 404, `${who} GET`)
    assert.equal(await listed(who, note._id), false, `${who} list`)
    assert.equal((await call(`/notes?q=${encodeURIComponent(`Owner private ${run}`)}`, { token: as(who) })).data.notes.length, 0, `${who} search`)
    assert.equal((await call(`/notes/${note._id}`, { method: "PATCH", token: as(who), body: { title: "x" } })).status, 404, `${who} PATCH`)
    assert.equal((await call(`/notes/${note._id}`, { method: "DELETE", token: as(who) })).status, 404, `${who} DELETE`)
    assert.equal((await fetch(`${BASE}/api/notes/${note._id}/attachments/voice`, { headers: { Authorization: `Bearer ${as(who)}` } })).status, 404, `${who} file`)
  }
  assert.equal(await sees("mod", note._id), 404, "moderator: indistinguishable from a missing note")
  assert.equal(await sees("cust", note._id), 403)
  assert.equal((await call(`/notes/${note._id}`)).status, 401)

  const sent = await fireNow(note._id)
  assert.deepEqual(reached(sent), ids("owner"))
  assert.ok(sent.recipients.every((x) => x.email), "email attempted for the creator")
  const notified = await NotificationModel.find({ type: "note_reminder", "data.noteId": String(note._id) }).lean()
  assert.deepEqual(notified.map((n) => String(n.user)).sort(), ids("owner"))
})

test("Scenario 2: an administrator's private note — other administrators and owners don't see it", async () => {
  const note = (await mkNote("admin", { title: `Admin private ${run}`, reminder: { enabled: true, at: future(10), email: true } })).data.note
  assert.equal(await sees("admin", note._id), 200)
  for (const who of ["admin2", "owner", "owner2", "super"]) {
    assert.equal(await sees(who, note._id), 404, who)
    assert.equal(await listed(who, note._id), false, who)
  }
  assert.deepEqual(reached(await fireNow(note._id)), ids("admin"))
})

test("Scenario 3: shared with owners — creator + owners see it and get the reminder, nobody else", async () => {
  const note = (await mkNote("admin", { title: `For owners ${run}`, content: "Please check", sharedWith: "owner", reminder: { enabled: true, at: future(10), email: true } })).data.note
  assert.equal(note.sharedWith, "owner")
  for (const who of ["admin", "owner", "owner2"]) assert.equal(await sees(who, note._id), 200, who)
  for (const who of ["admin2", "super"]) assert.equal(await sees(who, note._id), 404, who)
  assert.equal(await listed("owner", note._id, "&filter=shared"), true)
  const asOwner = (await call(`/notes/${note._id}`, { token: as("owner") })).data.note
  assert.equal(asOwner.isOwner, false)
  assert.equal(asOwner.createdByName, "E2E admin", "marked as shared by its creator")
  assert.equal(asOwner.canDelete, false)

  // Shared view-only by default; once the creator allows editing, people it's
  // shared with edit the text — never the settings.
  assert.equal(asOwner.access.mode, "view")
  assert.equal((await call(`/notes/${note._id}`, { method: "PATCH", token: as("owner"), body: { content: "Checked" } })).status, 403, "view only")
  assert.equal((await call(`/notes/${note._id}`, { method: "PATCH", token: as("admin"), body: { sharing: { roles: ["owner"], allowEditing: true } } })).status, 200)
  assert.equal((await call(`/notes/${note._id}`, { method: "PATCH", token: as("owner"), body: { content: "Checked" } })).status, 200)
  for (const body of [{ sharedWith: "everyone" }, { reminder: { enabled: false } }, { archived: true }, { expiresAt: null }]) {
    assert.equal((await call(`/notes/${note._id}`, { method: "PATCH", token: as("owner"), body })).status, 403, JSON.stringify(body))
  }
  assert.equal((await call(`/notes/${note._id}`, { method: "DELETE", token: as("owner") })).status, 403)
  // Pins are personal.
  assert.equal((await call(`/notes/${note._id}`, { method: "PATCH", token: as("owner"), body: { isPinned: true } })).data.note.isPinned, true)
  assert.equal((await call(`/notes/${note._id}`, { token: as("admin") })).data.note.isPinned, false)
  const stored = await Note.findById(note._id).lean()
  assert.equal(String(stored.createdBy), String(accounts.admin.user._id), "creator unchanged")

  const sent = await fireNow(note._id)
  assert.deepEqual(reached(sent), ids("admin", "owner", "owner2"))
  const toOwner = await NotificationModel.findOne({ user: accounts.owner.user._id, type: "note_reminder", "data.noteId": String(note._id) }).lean()
  assert.equal(toOwner.data.sharedBy, "E2E admin")
  assert.ok(toOwner.link.includes(`/notater?note=${note._id}`))
  const toAdmin = await NotificationModel.findOne({ user: accounts.admin.user._id, type: "note_reminder", "data.noteId": String(note._id) }).lean()
  assert.equal(toAdmin.data.sharedBy, "", "the creator isn't told they shared it")
})

test("Scenario 4 + 5: shared with everyone, then made private again", async () => {
  const note = (await mkNote("owner", { title: `Everyone ${run}`, sharedWith: "everyone", reminder: { enabled: true, at: future(10), email: true, recurrence: "daily" } })).data.note
  for (const who of ["owner", "owner2", "admin", "admin2", "super"]) assert.equal(await sees(who, note._id), 200, who)
  assert.equal(await sees("mod", note._id), 404, "\"everyone\" was owners + administrators; moderators aren't included")
  assert.equal(await sees("cust", note._id), 403)
  const sent = await fireNow(note._id)
  const got = reached(sent)
  for (const expected of ids("owner", "owner2", "admin", "admin2", "super")) assert.ok(got.includes(expected), `reminder reaches ${expected}`)
  for (const never of ids("mod", "cust", "target")) assert.ok(!got.includes(never), "never outside the Notes roles")
  assert.equal(new Set(got).size, got.length, "one delivery per person")

  // Scenario 5: sharing removed → only the creator keeps access (and its notifications).
  assert.equal((await call(`/notes/${note._id}`, { method: "PATCH", token: as("owner"), body: { sharedWith: "private" } })).status, 200)
  assert.equal(await sees("owner", note._id), 200)
  for (const who of ["owner2", "admin", "admin2", "super"]) {
    assert.equal(await sees(who, note._id), 404, who)
    assert.equal(await listed(who, note._id), false, who)
  }
  const left = await NotificationModel.find({ type: "note_reminder", "data.noteId": String(note._id) }).lean()
  assert.deepEqual([...new Set(left.map((n) => String(n.user)))], ids("owner"), "others' reminder notifications removed")
  assert.deepEqual(reached(await fireNow(note._id)), ids("owner"), "next reminder: creator only")
})

test("Scenario 6 + 7: to-dos live apart from notes; completing one stops its reminder", async () => {
  const todo = (await mkNote("admin", { kind: "todo", title: `Call customer ${run}`, dueDate: "2099-12-31", reminder: { enabled: true, at: future(10), recurrence: "daily", email: false } })).data.note
  assert.equal(todo.kind, "todo")
  assert.equal(todo.dueDate, "2099-12-31")
  assert.equal(await listed("admin", todo._id), false, "not in the Notes list")
  assert.equal(await listed("admin", todo._id, "&kind=todo"), true, "in the to-do list")
  assert.equal((await mkNote("admin", { kind: "todo", content: "no title" })).status, 400, "a to-do needs its task")
  assert.equal((await mkNote("admin", { kind: "todo", title: "x", dueDate: "2099-02-30" })).status, 400, "bad due date")
  assert.equal((await mkNote("admin", { kind: "list", title: "x" })).status, 400)
  assert.equal(await sees("admin2", todo._id), 404, "to-dos are private too")

  const done = (await call(`/notes/${todo._id}`, { method: "PATCH", token: as("admin"), body: { isCompleted: true } })).data.note
  assert.ok(done.isCompleted && done.completedAt)
  assert.equal(await fireNow(todo._id), undefined, "completed to-do: no reminder, even a recurring one")
  assert.equal((await Note.findById(todo._id).lean()).reminder.nextAt, null)
  const back = (await call(`/notes/${todo._id}`, { method: "PATCH", token: as("admin"), body: { isCompleted: false } })).data.note
  assert.equal(back.completedAt, null)
})

test("Sharing options are validated; the counts reveal no one", async () => {
  assert.equal((await mkNote("admin", { title: "x", sharedWith: "customers" })).status, 400)
  assert.equal((await mkNote("admin", { title: "x", sharedWith: "moderator" })).status, 400)
  const meta = await call("/notes?countOnly=1&withMeta=1", { token: as("admin") })
  assert.equal(meta.data.audience.private, 0)
  assert.ok(meta.data.audience.owner >= 2 && meta.data.audience.everyone >= meta.data.audience.owner)
  assert.equal(JSON.stringify(meta.data).includes("@"), false, "no one's email in the sharing counts")
})


// ---------------------------------------------------------------------------
// User management: ban / unban / delete (Super Admin only)
// ---------------------------------------------------------------------------
const { DeletedUser } = await import("../lib/models/DeletedUser.js")
const { SiteContent } = await import("../lib/models/SiteContent.js")
const saUser = (id, init) => call(`/superadmin/users/${id}`, { token: as("super"), ...init })

test("User management: only the Super Admin can list, ban, unban or delete", async () => {
  const target = accounts.victim.user._id
  for (const who of ["admin", "owner", "mod", "cust"]) {
    assert.equal((await call("/superadmin/users", { token: as(who) })).status, 403, `${who} list`)
    assert.equal((await call(`/superadmin/users/${target}`, { method: "PATCH", token: as(who), body: { status: "banned" } })).status, 403, `${who} ban`)
    assert.equal((await call(`/superadmin/users/${target}`, { method: "DELETE", token: as(who) })).status, 403, `${who} delete`)
  }
  assert.equal((await call(`/superadmin/users/${target}`, { method: "DELETE" })).status, 401)
  // The Super Admin can't ban or delete themselves (the protected account).
  assert.equal((await saUser(accounts.super.user._id, { method: "PATCH", body: { status: "banned" } })).status, 403)
  assert.equal((await saUser(accounts.super.user._id, { method: "DELETE" })).status, 403)
  assert.equal((await saUser(target, { method: "PATCH", body: { status: "suspended" } })).status, 400, "unknown status")
  assert.equal((await User.findById(target).lean()).status ?? "active", "active", "nothing changed")
})

test("User management: a banned user loses access immediately and regains it when unbanned", async () => {
  const id = accounts.banme.user._id
  assert.equal((await call("/orders", { token: as("banme") })).status, 200, "works before the ban")

  const ban = await saUser(id, { method: "PATCH", body: { status: "banned", reason: "E2E test" } })
  assert.equal(ban.status, 200, JSON.stringify(ban.data))
  assert.equal(ban.data.user.status, "banned")
  assert.equal(ban.data.user.banReason, "E2E test")
  assert.equal(ban.data.message, "User banned")

  // The same, still-valid Firebase token is now refused everywhere.
  for (const [p, method] of [["/auth/sync", "POST"], ["/auth/me", "GET"], ["/orders", "GET"], ["/notes", "GET"], ["/reports/monthly", "GET"]]) {
    const r = await call(p, { method, token: as("banme"), body: method === "POST" ? {} : undefined })
    assert.equal(r.status, 403, p)
    assert.equal(r.data.code, "ACCOUNT_BANNED", p)
  }
  // Signing in again (fresh token) doesn't help.
  const fresh = (await firebase("signInWithPassword", { email: accounts.banme.email, password: PASSWORD, returnSecureToken: true })).idToken
  assert.equal((await call("/auth/sync", { method: "POST", token: fresh, body: {} })).status, 403)
  const banned = await call("/superadmin/users?status=banned", { token: as("super") })
  assert.ok(banned.data.users.some((u) => u._id === String(id)))
  assert.ok(!(await call(`/superadmin/users?status=active&search=${run}`, { token: as("super") })).data.users.some((u) => u._id === String(id)))

  const unban = await saUser(id, { method: "PATCH", body: { status: "active" } })
  assert.equal(unban.status, 200)
  assert.equal(unban.data.user.status, "active")
  assert.equal((await call("/orders", { token: as("banme") })).status, 200, "access restored")
  assert.equal((await call("/auth/me", { token: as("banme") })).data.access.role, "administrator", "same role as before")

  const actions = (await AuditLog.find({ target: id }).sort({ createdAt: 1 }).lean()).map((e) => e.action)
  assert.deepEqual(actions, ["USER_BANNED", "USER_UNBANNED"])
})

test("User management: deleting a user removes the profile and private notes; signing in again starts a brand-new customer account", async () => {
  const id = accounts.victim.user._id
  // The victim is made staff briefly so they own a note and appear in someone's sharing.
  await saUser(id, { method: "PATCH", body: { role: "owner" } })
  const own = (await mkNote("victim", { title: `Victim note ${run}` })).data.note
  const shared = (await mkNote("admin", { title: `Shared with victim ${run}`, sharing: { userIds: [String(id)] } })).data.note
  assert.equal(await sees("victim", shared._id), 200)

  const r = await saUser(id, { method: "DELETE" })
  assert.equal(r.status, 200, JSON.stringify(r.data))
  assert.equal(r.data.message, "User deleted")
  assert.equal(await User.exists({ _id: id }), null)
  assert.ok(await DeletedUser.exists({ firebaseUid: accounts.victim.uid }))
  assert.equal(await Note.exists({ _id: own._id }), null, "their notes are gone")
  assert.deepEqual((await Note.findById(shared._id).lean()).sharedUserIds, [], "removed from others' sharing")
  assert.equal((await saUser(id, { method: "GET" })).status, 404)

  assert.ok(await AuditLog.exists({ action: "USER_DELETED", target: id }))

  // Signing in again (same email/password login): a new, confirmed customer
  // profile — no old role, notes or sharing come back.
  const again = await call("/auth/sync", { method: "POST", token: as("victim"), body: {} })
  assert.equal(again.status, 200, JSON.stringify(again.data))
  assert.notEqual(String(again.data.user._id), String(id), "a new profile, not the deleted one")
  assert.deepEqual([again.data.user.role, again.data.access.role, again.data.user.emailVerified], ["customer", "customer", true])
  assert.equal(await User.countDocuments({ firebaseUid: accounts.victim.uid }), 1, "exactly one profile")
  assert.equal((await call("/notes", { token: as("victim") })).status, 403, "a customer has no notes")
  assert.equal(await sees("admin", shared._id), 200, "others' notes unaffected")
  accounts.victim.user = await User.findOne({ firebaseUid: accounts.victim.uid })
})

// ---------------------------------------------------------------------------
// Role permission sets
// ---------------------------------------------------------------------------
const roles = (init) => call("/superadmin/roles", { token: as("super"), ...init })

test("Roles: only the Super Admin reads or changes role permissions; no escalation", async () => {
  for (const who of ["admin", "owner", "mod"]) {
    assert.equal((await call("/superadmin/roles", { token: as(who) })).status, 403, `${who} read`)
    assert.equal((await call("/superadmin/roles", { method: "PUT", token: as(who), body: { role: "administrator", permissions: ["roles.manage"] } })).status, 403, `${who} write`)
  }
  const m = await roles()
  assert.equal(m.status, 200)
  assert.deepEqual(m.data.roles.map((r) => r.role), ["administrator", "owner", "moderator"])
  assert.ok(m.data.roles.every((r) => !r.customized), "defaults until saved")
  assert.ok(m.data.roles.find((r) => r.role === "administrator").locked.includes("users.delete"))
  // Nothing grants access-control powers or a Super Admin role.
  assert.equal((await roles({ method: "PUT", body: { role: "administrator", permissions: ["orders.view", "roles.manage"] } })).status, 400)
  assert.equal((await roles({ method: "PUT", body: { role: "moderator", permissions: ["users.ban"] } })).status, 400)
  assert.equal((await roles({ method: "PUT", body: { role: "superadmin", permissions: [] } })).status, 400)
  assert.equal((await roles({ method: "PUT", body: { role: "customer", permissions: ["orders.view"] } })).status, 400)
  assert.equal((await roles({ method: "PUT", body: { role: "administrator", permissions: ["made.up"] } })).status, 400)
  assert.equal((await roles({ method: "PUT", body: { role: "administrator", permissions: "orders.view" } })).status, 400)
})

test("Roles: changing Administrator permissions applies to every administrator on their next request", async () => {
  const before = (await roles()).data.roles.find((r) => r.role === "administrator").permissions
  assert.equal((await call("/reports/monthly", { token: as("admin") })).status, 200)
  const without = before.filter((p) => p !== "reports.view")
  const saved = await roles({ method: "PUT", body: { role: "administrator", permissions: without } })
  assert.equal(saved.status, 200)
  assert.equal(saved.data.message, "Permissions saved")
  const adminRow = saved.data.roles.find((r) => r.role === "administrator")
  assert.equal(adminRow.customized, true)
  assert.ok(!adminRow.permissions.includes("reports.view"))

  for (const who of ["admin", "admin2"]) {
    assert.equal((await call("/reports/monthly", { token: as(who) })).status, 403, `${who} lost it`)
    assert.ok(!(await call("/auth/me", { token: as(who) })).data.access.permissions.includes("reports.view"))
  }
  assert.equal((await call("/reports/monthly", { token: as("owner") })).status, 200, "other roles untouched")
  assert.equal((await call("/reports/monthly", { token: as("mod") })).status, 403, "moderator gains nothing")
  assert.equal((await call("/reports/monthly", { token: as("super") })).status, 200, "Super Admin keeps full access")
  assert.equal((await call("/orders", { token: as("admin") })).status, 200, "the rest of the role still works")

  // Granting it back works the same way.
  await roles({ method: "PUT", body: { role: "administrator", permissions: [...without, "reports.view"] } })
  assert.equal((await call("/reports/monthly", { token: as("admin") })).status, 200)

  // Moderator: add a permission, then reset the role to its defaults.
  await roles({ method: "PUT", body: { role: "moderator", permissions: [...(await roles()).data.roles.find((r) => r.role === "moderator").permissions, "reports.view"] } })
  assert.equal((await call("/reports/monthly", { token: as("mod") })).status, 200)
  assert.equal((await call("/superadmin/users", { token: as("mod") })).status, 403, "still no Super Admin access")
  const reset = await roles({ method: "PUT", body: { role: "moderator", reset: true } })
  assert.equal(reset.data.roles.find((r) => r.role === "moderator").customized, false)
  assert.equal((await call("/reports/monthly", { token: as("mod") })).status, 403)
  await roles({ method: "PUT", body: { role: "administrator", reset: true } })

  const logged = (await AuditLog.find({ action: "ROLE_PERMISSIONS_UPDATED", role: "administrator" }).sort({ createdAt: 1 }).lean())
  assert.deepEqual(logged[0].removed, ["reports.view"])
  assert.deepEqual(logged[1].added, ["reports.view"])
  assert.ok(await AuditLog.exists({ action: "ROLE_PERMISSIONS_RESET", role: "moderator" }))
})

// ---------------------------------------------------------------------------
// Website Editor: shared values vs translations
// ---------------------------------------------------------------------------
const LANGS = ["no", "en", "sv", "fi", "da", "ro"]
const siteContent = async (lang) => (await call(`/site-content?lang=${lang}`)).data.content
const putContent = (key, body, who = "admin") => call(`/site-content/${encodeURIComponent(key)}`, { method: "PUT", token: as(who), body })

test("Website Editor: copyright year changed from English shows in every language", async () => {
  // The reported bug, as stored before the fix: a whole-sentence override
  // saved for English only. Every language already follows its year.
  await SiteContent.create({ contentKey: "footer.copyright", language: "en", type: "text", value: "© 2026 ProVisuell AS. All rights reserved." })
  for (const lang of LANGS) assert.equal((await siteContent(lang))["footer.copyrightYear"], "2026", `legacy ${lang}`)

  const r = await putContent("footer.copyrightYear", { value: "2027", language: "en", type: "text" })
  assert.equal(r.status, 200)
  assert.equal(r.data.shared, true)
  assert.equal(r.data.content.language, null, "stored once")
  for (const lang of LANGS) assert.equal((await siteContent(lang))["footer.copyrightYear"], "2027", lang)
})

test("Website Editor: a translated heading changes one language only", async () => {
  const before = await siteContent("no")
  const r = await putContent("hero.title", { value: `E2E heading ${run}`, language: "en", type: "text" })
  assert.equal(r.status, 200)
  assert.equal(r.data.shared, false)
  assert.equal((await siteContent("en"))["hero.title"], `E2E heading ${run}`)
  for (const lang of ["no", "sv", "fi", "da", "ro"]) assert.notEqual((await siteContent(lang))["hero.title"], `E2E heading ${run}`, lang)
  assert.equal((await siteContent("no"))["hero.title"], before["hero.title"], "Norwegian unchanged")
})

test("Website Editor: a global phone number is the same in every language; old per-language copies are cleared", async () => {
  // A stale per-language copy from before the fix.
  await SiteContent.create({ contentKey: "footer.phone", language: "no", type: "text", value: "+47 000 00 000" })
  const r = await putContent("footer.phone", { value: "+47 987 65 432", language: "sv", type: "text" })
  assert.equal(r.status, 200)
  for (const lang of LANGS) assert.equal((await siteContent(lang))["footer.phone"], "+47 987 65 432", lang)
  assert.deepEqual((await SiteContent.find({ contentKey: "footer.phone" }).lean()).map((d) => d.language), [null])
  // Editing still needs "cms.edit".
  for (const who of ["owner", "mod", "cust"]) assert.equal((await putContent("footer.phone", { value: "x" }, who)).status, 403, who)
})

// ---------------------------------------------------------------------------
// Notes: sharing with roles / people, view-only vs editing, edit history
// ---------------------------------------------------------------------------
const patchNote = (who, id, body) => call(`/notes/${id}`, { method: "PATCH", token: as(who), body })
const share = (id, sharing, who = "owner") => patchNote(who, id, { sharing })

test("Shared notes: private → view-only → editable → view-only → private", async () => {
  const note = (await mkNote("owner", { title: `Shared plan ${run}`, content: "v1" })).data.note
  assert.equal(note.sharing.visibility, "private")
  assert.equal(note.access.mode, "owner")
  for (const who of ["admin", "admin2", "mod", "owner2", "super"]) assert.equal(await sees(who, note._id), 404, `${who} can't see a private note`)

  // Shared with administrators, view only.
  let r = await share(note._id, { roles: ["administrator"], allowEditing: false })
  assert.equal(r.status, 200)
  assert.deepEqual([r.data.note.sharing.visibility, r.data.note.sharing.roles, r.data.note.sharing.allowEditing], ["shared", ["administrator"], false])
  const asAdmin = (await call(`/notes/${note._id}`, { token: as("admin") })).data.note
  assert.deepEqual([asAdmin.isOwner, asAdmin.access.mode, asAdmin.access.canEdit, asAdmin.access.canDelete, asAdmin.access.canShare], [false, "view", false, false, false])
  assert.deepEqual(asAdmin.sharing.users, [], "who else it's shared with stays the creator's business")
  assert.ok((await call("/notes?filter=sharedWithMe", { token: as("admin") })).data.notes.some((n) => n._id === note._id))
  // A direct edit attempt fails.
  r = await patchNote("admin", note._id, { content: "hacked" })
  assert.equal(r.status, 403)
  assert.equal(r.data.error, "You have view-only access to this note")
  assert.equal((await Note.findById(note._id).lean()).content, "v1")

  // Editing enabled → the administrator edits; they become the last editor.
  await share(note._id, { roles: ["administrator"], allowEditing: true })
  r = await patchNote("admin", note._id, { content: "v2 by admin" })
  assert.equal(r.status, 200, JSON.stringify(r.data))
  assert.equal(r.data.note.lastEdited.name, "E2E admin")
  assert.equal(r.data.note.lastEdited.role, "administrator")
  const asCreator = (await call(`/notes/${note._id}`, { token: as("owner") })).data.note
  assert.equal(asCreator.createdByName, "E2E owner", "creator unchanged")
  assert.equal(asCreator.isOwner, true)
  assert.equal(asCreator.lastEdited.name, "E2E admin")
  assert.equal(asCreator.lastEdited.byMe, false)
  const stored = await Note.findById(note._id).lean()
  assert.equal(String(stored.createdBy), String(accounts.owner.user._id))
  assert.equal(String(stored.lastEditedBy), String(accounts.admin.user._id))

  // Edit history: who changed what.
  const history = await call(`/notes/${note._id}/history`, { token: as("owner") })
  assert.equal(history.status, 200)
  assert.equal(history.data.createdBy.name, "E2E owner")
  assert.equal(history.data.entries[0].editor.name, "E2E admin")
  assert.equal(history.data.entries[0].previous.content, "v1")
  assert.equal(history.data.entries[0].updated.content, "v2 by admin")
  assert.equal((await call(`/notes/${note._id}/history`, { token: as("owner2") })).status, 404, "history is as private as the note")

  // Editing never grants deleting, re-sharing, settings or a new creator.
  assert.equal((await share(note._id, { roles: ["administrator", "moderator"] }, "admin")).status, 403)
  assert.equal((await patchNote("admin", note._id, { archived: true })).status, 403)
  assert.equal((await call(`/notes/${note._id}`, { method: "DELETE", token: as("admin") })).status, 403)
  await patchNote("admin", note._id, { content: "v3", createdBy: String(accounts.admin.user._id) })
  assert.equal(String((await Note.findById(note._id).lean()).createdBy), String(accounts.owner.user._id), "creatorId from the browser ignored")

  // Editing disabled again → edit access gone.
  await share(note._id, { roles: ["administrator"], allowEditing: false })
  assert.equal((await patchNote("admin", note._id, { content: "v4" })).status, 403)
  assert.equal((await call(`/notes/${note._id}`, { token: as("admin") })).data.note.access.mode, "view")

  // Sharing removed → the administrator no longer sees it at all.
  await share(note._id, { visibility: "private" })
  assert.equal(await sees("admin", note._id), 404)
  assert.equal(await listed("admin", note._id), false)
  assert.equal(await listed("admin", note._id, "&filter=shared"), false)
})

test("Shared notes: several roles at once reach exactly those roles (and their reminders)", async () => {
  const note = (await mkNote("owner", { title: `Multi ${run}`, reminder: { enabled: true, at: future(10), email: false } })).data.note
  const r = await share(note._id, { roles: ["moderator", "owner"], allowEditing: false })
  assert.equal(r.status, 200)
  for (const who of ["mod", "owner2"]) assert.equal(await sees(who, note._id), 200, who)
  for (const who of ["admin", "admin2", "super", "banme"]) assert.equal(await sees(who, note._id), 404, `${who} (administrators not included)`)
  assert.equal(await sees("cust", note._id), 403)
  const sent = await fireNow(note._id)
  assert.deepEqual(reached(sent), ids("owner", "owner2", "mod"))

  // Administrators + moderators; editing allowed → a moderator may edit.
  await share(note._id, { roles: ["administrator", "moderator"], allowEditing: true })
  assert.equal(await sees("owner2", note._id), 404, "owners removed")
  for (const who of ["admin", "admin2", "super", "mod"]) assert.equal(await sees(who, note._id), 200, who)
  const byMod = await patchNote("mod", note._id, { content: "Checked by moderator" })
  assert.equal(byMod.status, 200)
  assert.equal(byMod.data.note.lastEdited.role, "moderator")
})

test("Shared notes: individual people, validated recipients, and who may share", async () => {
  const note = (await mkNote("admin", { title: `Personal ${run}` })).data.note
  // Only existing staff who can use Notes; the creator is dropped silently.
  assert.equal((await share(note._id, { userIds: [String(accounts.cust.user._id)] }, "admin")).status, 400, "customer")
  assert.equal((await share(note._id, { userIds: ["000000000000000000000000"] }, "admin")).status, 400, "unknown")
  assert.equal((await share(note._id, { roles: ["customer"] }, "admin")).status, 400)
  const r = await share(note._id, { userIds: [String(accounts.admin2.user._id), String(accounts.admin.user._id)] }, "admin")
  assert.equal(r.status, 200)
  assert.deepEqual(r.data.note.sharing.users.map((u) => u._id), [String(accounts.admin2.user._id)])
  assert.equal(r.data.note.sharing.users[0].name, "E2E admin2")
  assert.equal(await sees("admin2", note._id), 200)
  for (const who of ["owner", "mod", "super"]) assert.equal(await sees(who, note._id), 404, who)

  // Share targets: staff only, never customers; only for people who may share.
  const targets = await call("/notes/share-targets", { token: as("admin") })
  assert.equal(targets.status, 200)
  const targetIds = targets.data.users.map((u) => u._id)
  assert.ok(targetIds.includes(String(accounts.mod.user._id)) && targetIds.includes(String(accounts.owner.user._id)))
  assert.ok(!targetIds.includes(String(accounts.cust.user._id)) && !targetIds.includes(String(accounts.admin.user._id)))
  assert.equal((await call("/notes/share-targets", { token: as("mod") })).status, 403)

  // Without "notes.share", a note can't be shared (it can still be written).
  await saUser(accounts.owner2.user._id, { method: "PATCH", body: { permission: "notes.share", state: "deny" } })
  assert.equal((await mkNote("owner2", { title: "x", sharing: { roles: ["owner"] } })).status, 403)
  const mine = await mkNote("owner2", { title: `Owner2 private ${run}` })
  assert.equal(mine.status, 201)
  assert.equal(mine.data.note.access.canShare, false)
  assert.equal((await share(mine.data.note._id, { roles: ["owner"] }, "owner2")).status, 403)
  await saUser(accounts.owner2.user._id, { method: "PATCH", body: { reset: true } })

  // Moderator: reads what's shared with them; can't create or share.
  assert.equal((await mkNote("mod", { title: "x" })).status, 403)
  await saUser(accounts.mod.user._id, { method: "PATCH", body: { permission: "notes.view", state: "deny" } })
  assert.equal((await call("/notes", { token: as("mod") })).status, 403, "notes.view denied → no Notes at all")
  await saUser(accounts.mod.user._id, { method: "PATCH", body: { reset: true } })
})

test("Shared notes: the recipient's list has their own notes and shared ones, each exactly once", async () => {
  const own = (await mkNote("admin2", { title: `Own ${run}` })).data.note
  // Shared with admin2 personally AND with their role.
  const both = (await mkNote("owner", { title: `Both rules ${run}`, sharing: { roles: ["administrator"], userIds: [String(accounts.admin2.user._id)] } })).data.note
  const list = (await call("/notes?limit=50", { token: as("admin2") })).data
  const all = [...(list.pinned || []), ...list.notes].map((n) => n._id)
  assert.ok(all.includes(own._id), "own note")
  assert.equal(all.filter((id) => id === both._id).length, 1, "matched by two rules, listed once")
  const shared = (await call("/notes?filter=sharedWithMe&limit=50", { token: as("admin2") })).data.notes
  assert.equal(shared.filter((n) => n._id === both._id).length, 1)
  assert.ok(!shared.some((n) => n._id === own._id), "own notes aren't 'shared with me'")
  const n = shared.find((x) => x._id === both._id)
  assert.deepEqual([n.sharing.sharedWithMe, n.createdByName, n.createdByRole, n.access.mode], [true, "E2E owner", "owner", "view"])
})

test("Shared notes: files and voice notes reach exactly the people who can see the note", async () => {
  const note = (await mkNote("owner", { title: `Files ${run}` })).data.note
  const upload = async (bytes, name, kind) => {
    const form = new FormData()
    form.append("file", new Blob([bytes], { type: kind === "voice" ? "audio/webm" : "application/octet-stream" }), name)
    form.append("kind", kind)
    const res = await fetch(`${BASE}/api/notes/${note._id}/attachments`, { method: "POST", headers: { Authorization: `Bearer ${as("owner")}` }, body: form })
    return (await res.json()).note
  }
  await upload(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]), "photo.png", "file")
  const withVoice = await upload(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01]), "blob", "voice")
  const fileId = withVoice.attachments[0]._id
  const get = (who, id) => fetch(`${BASE}/api/notes/${note._id}/attachments/${id}`, { headers: { Authorization: `Bearer ${as(who)}` } }).then((r) => r.status)

  for (const who of ["mod", "admin"]) {
    assert.equal(await get(who, fileId), 404, `${who}: private note's file`)
    assert.equal(await get(who, "voice"), 404, `${who}: private note's voice note`)
  }
  await share(note._id, { roles: ["moderator"], allowEditing: false })
  assert.equal(await get("mod", fileId), 200, "recipient gets the file")
  assert.equal(await get("mod", "voice"), 200, "recipient gets the voice note")
  assert.equal(await get("admin", fileId), 404, "not shared with administrators")
  // Unshared → gone again.
  await share(note._id, { visibility: "private" })
  assert.equal(await get("mod", "voice"), 404)
})

test("Bans: login, signup (any case) and the emailed link are refused until unbanned; a banned account can't be deleted", async () => {
  const { AccountBan } = await import("../lib/models/AccountBan.js")
  const id = accounts.banned2.user._id
  const email = accounts.banned2.email
  const signup = (addr) => call("/auth/signup", { method: "POST", body: { name: "Again", email: addr, password: "abcdef1", confirmPassword: "abcdef1" } })
  const freshSync = async () => {
    const idToken = (await firebase("signInWithPassword", { email, password: PASSWORD, returnSecureToken: true })).idToken
    return call("/auth/sync", { method: "POST", token: idToken, body: {} })
  }
  assert.equal((await saUser(id, { method: "PATCH", body: { status: "banned", reason: "e2e" } })).status, 200)
  assert.ok(await AccountBan.exists({ email: email.toLowerCase(), active: true }), "lasting ban record")

  // Email/password login: Firebase signs in, our server refuses.
  let r = await freshSync()
  assert.deepEqual([r.status, r.data.code, r.data.error], [403, "ACCOUNT_BANNED", "This account has been banned"])
  // Signing up again with the same email, in any letter case.
  for (const addr of [email, email.toUpperCase(), `  ${email}  `]) {
    r = await signup(addr)
    assert.deepEqual([r.status, r.data.code], [403, "ACCOUNT_BANNED"], addr)
  }

  // A banned account can't be deleted (it would leave a ban nobody can lift).
  r = await saUser(id, { method: "DELETE" })
  assert.deepEqual([r.status, r.data.error], [409, "Unban this account before deleting it"])
  assert.ok(await User.exists({ _id: id }), "still there, still banned")

  // Until unbanned: still refused. After the unban: in again, same account.
  assert.equal((await saUser(id, { method: "PATCH", body: { status: "active" } })).status, 200)
  assert.equal(await AccountBan.exists({ email: email.toLowerCase(), active: true }), null, "ban lifted")
  r = await freshSync()
  assert.equal(r.status, 200, "can sign in again after the unban")
  assert.equal(String(r.data.user._id), String(id))
  // Deleting is allowed once unbanned — and the person may then start over.
  assert.equal((await saUser(id, { method: "DELETE" })).status, 200)
  r = await freshSync()
  assert.equal(r.status, 200, "re-created after deletion")
  assert.notEqual(String(r.data.user._id), String(id), "as a brand-new profile")

  // A link emailed before the ban: opening it creates nothing.
  const lateEmail = emailFor("late-ban")
  const { key, iv, tag, ciphertext } = encryptPassword(PASSWORD)
  const pending = await PendingSignup.create({ email: lateEmail, name: "Late", iv, tag, ciphertext, keyHash: hashKey(key) })
  await AccountBan.create({ email: lateEmail, active: true })
  r = await call("/auth/signup/verify", { method: "POST", body: { token: buildToken(String(pending._id), key) } })
  assert.deepEqual([r.status, r.data.code], [403, "ACCOUNT_BANNED"])
  await assert.rejects(firebase("signInWithPassword", { email: lateEmail, password: PASSWORD, returnSecureToken: true }), "no Firebase account was created")
  assert.equal(await User.exists({ email: lateEmail }), null)
})

test("A request with an invalid or missing token is refused without touching any account", async () => {
  assert.equal((await call("/auth/sync", { method: "POST", token: "not.a.token", body: {} })).status, 401)
  assert.equal((await call("/auth/sync", { method: "POST", body: {} })).status, 401)
  assert.equal((await call("/notifications/unread-count", { token: "expired.or.forged" })).status, 401)
})

test("Notes: existing Orders, Meetings, Invoices and Reports still work", async () => {
  assert.equal((await call("/orders", { token: as("admin") })).status, 200)
  assert.equal((await call(`/appointments?id=${records.appointment._id}`, { token: as("admin") })).data.appointments.length, 1)
  assert.equal((await call(`/invoices/${records.invoice._id}`, { token: as("owner") })).status, 200)
  assert.equal((await call("/reports/monthly", { token: as("owner") })).status, 200)
  assert.equal((await call("/auth/me", { token: as("cust") })).status, 200)
})
