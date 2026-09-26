// Account identity rules (lib/accountIdentity.js) against a throwaway
// database: what /api/auth/sync does with a verified sign-in that has no
// profile yet — e.g. "Continue with Google" when the Firebase project gives
// Google and email/password separate UIDs for the same email. The decoded
// token claims are passed in directly (the Firebase signature check itself is
// covered by the end-to-end tests).
//
//   npm run test:db
import test, { after, before } from "node:test"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })
const TEST_DB = "provisuell_identity_test"
if (!process.env.MONGO_URI) throw new Error("MONGO_URI missing in .env.local")
process.env.MONGO_URI = process.env.MONGO_URI.replace(/(mongodb(?:\+srv)?:\/\/[^/]+)\/[^?]*/, `$1/${TEST_DB}`)

const mongoose = (await import("mongoose")).default
const { connectDB } = await import("../lib/db.js")
const { User } = await import("../lib/models/User.js")
const { DeletedUser } = await import("../lib/models/DeletedUser.js")
const { AccountBan } = await import("../lib/models/AccountBan.js")
const identity = await import("../lib/accountIdentity.js")
const { isProtectedSuperAdmin } = await import("../lib/access.js")

const uid = () => crypto.randomBytes(14).toString("base64url")
// What authenticate() passes as `create` for a brand-new identity.
const createFor = (decoded) => () =>
  User.findOneAndUpdate({ firebaseUid: decoded.sub }, { $setOnInsert: { firebaseUid: decoded.sub, email: decoded.email, name: "New" } }, { upsert: true, new: true })
const signIn = async (decoded) => (await identity.findProfileByUid(decoded.sub)) || identity.resolveNewIdentity(decoded, { create: createFor(decoded) })
const google = (email, sub = uid()) => ({ sub, email, email_verified: true, firebase: { sign_in_provider: "google.com" } })
const password = (email, sub = uid()) => ({ sub, email, email_verified: false, firebase: { sign_in_provider: "password" } })
const rejects = (promise, code) => assert.rejects(promise, (err) => err.code === code)

before(async () => {
  await connectDB()
  assert.equal(mongoose.connection.name, TEST_DB, "refusing to run outside the test database")
  await mongoose.connection.dropDatabase()
  await User.init()
})

after(async () => {
  if (mongoose.connection.name === TEST_DB) await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
})

test("brand-new Google user gets exactly one new profile; signing in again reuses it", async () => {
  const g = google("new.person@example.com")
  const first = await signIn(g)
  const again = await signIn(g)
  assert.equal(String(first._id), String(again._id))
  assert.equal(await User.countDocuments({ email: "new.person@example.com" }), 1)
})

test("Google with the email of an existing email/password profile opens THAT profile (linked, no duplicate, same role)", async () => {
  const existing = await User.create({ firebaseUid: uid(), email: "Kari.Owner@Example.com", role: "owner", emailVerified: true })
  const g = google("kari.owner@example.com")
  const profile = await signIn(g)
  assert.equal(String(profile._id), String(existing._id))
  assert.equal(profile.role, "owner", "role kept, not reset or raised")
  assert.deepEqual(profile.linkedFirebaseUids, [g.sub])
  assert.equal(await User.countDocuments(identity.emailQuery("kari.owner@example.com")), 1, "no second profile")
  // Next time it's found directly by the linked UID.
  assert.equal(String((await identity.findProfileByUid(g.sub))._id), String(existing._id))
})

test("the reported case: Google identity deleted, same email still has an active profile → signs into the active profile", async () => {
  const active = await User.create({ firebaseUid: uid(), email: "ca.customer@example.com", role: "customer", emailVerified: true })
  const g = google("ca.customer@example.com")
  await DeletedUser.create({ firebaseUid: g.sub, email: "ca.customer@example.com", role: "customer" })
  const profile = await signIn(g)
  assert.equal(String(profile._id), String(active._id), "the active account, not a revived deleted one")
  assert.equal(profile.role, "customer")
})

test("a deleted account can be re-created: a brand-new profile, nothing of the old one", async () => {
  const g = google("gone@example.com")
  const old = await User.create({ firebaseUid: g.sub, email: "gone@example.com", role: "administrator", permissionGrants: ["reports.view"] })
  await DeletedUser.create({ firebaseUid: g.sub, email: "gone@example.com", role: "administrator" })
  await User.deleteOne({ _id: old._id })
  const fresh = await signIn(g)
  assert.notEqual(String(fresh._id), String(old._id), "a new profile, not the old one revived")
  assert.equal(fresh.role, "customer", "no old role")
  assert.equal(fresh.permissionGrants, undefined, "no old permissions")
  assert.equal(await User.countDocuments(identity.emailQuery("gone@example.com")), 1, "exactly one profile")
})

test("an unverified email never links to someone else's profile", async () => {
  const victim = await User.create({ firebaseUid: uid(), email: "victim@example.com", role: "administrator", emailVerified: true })
  const p = password("victim@example.com")
  // Unconfirmed password identities don't get linked (authenticate() then
  // refuses to create a profile for them: "Email not verified").
  const created = await identity.resolveNewIdentity(p, { create: async () => "would-create" })
  assert.equal(created, "would-create")
  assert.equal((await User.findById(victim._id)).linkedFirebaseUids, undefined)
})

test("ban: every sign-in method and every new identity with that email is refused, even after the profile is deleted", async () => {
  const actor = await User.create({ firebaseUid: uid(), email: "sa@example.com", role: "administrator" })
  const pw = password("bad.actor@example.com")
  const user = await User.create({ firebaseUid: pw.sub, email: "Bad.Actor@example.com", role: "administrator", emailVerified: true })
  const googleFirst = google("bad.actor@example.com")
  await signIn(googleFirst) // linked before the ban
  await identity.banIdentity({ user: await User.findById(user._id), actor, reason: "test" })

  const ban = await AccountBan.findOne({ email: "bad.actor@example.com", active: true }).lean()
  assert.ok(ban)
  assert.deepEqual(ban.firebaseUids.sort(), [pw.sub, googleFirst.sub].sort(), "both identities recorded")
  assert.equal((await User.findById(user._id)).status, "banned")

  // A new Google identity, a new password identity, any case of the email.
  await rejects(signIn(google("BAD.ACTOR@example.com")), "ACCOUNT_BANNED")
  await rejects(identity.resolveNewIdentity(password("bad.actor@example.com"), { create: createFor(password("x")) }), "ACCOUNT_BANNED")
  await rejects(identity.assertNotBanned({ email: " Bad.Actor@Example.com " }), "ACCOUNT_BANNED")

  // The profile is deleted: the ban stays, and deletion can't be used to start over.
  await DeletedUser.create({ firebaseUid: pw.sub, email: "bad.actor@example.com" })
  await User.deleteOne({ _id: user._id })
  await rejects(signIn(pw), "ACCOUNT_BANNED")
  await rejects(signIn(googleFirst), "ACCOUNT_BANNED")
  await rejects(signIn(google("bad.actor@example.com")), "ACCOUNT_BANNED")
  assert.equal(await User.countDocuments(identity.emailQuery("bad.actor@example.com")), 0, "no new profile was created")
  // A ban also matches by UID alone (e.g. the email changed at the provider).
  await rejects(signIn(google("renamed@example.com", pw.sub)), "ACCOUNT_BANNED")
})

test("a banned person can't re-create an account until unbanned — then they can", async () => {
  const actor = await User.create({ firebaseUid: uid(), email: "sa3@example.com" })
  const user = await User.create({ firebaseUid: uid(), email: "second.chance@example.com", role: "customer", emailVerified: true })
  await identity.banIdentity({ user, actor })
  const g = google("second.chance@example.com")
  await rejects(signIn(g), "ACCOUNT_BANNED")
  await identity.liftIdentityBan({ user: await User.findById(user._id), actor })
  const back = await signIn(g)
  assert.equal(String(back._id), String(user._id), "after the unban the same person gets in (linked, not duplicated)")
  assert.equal(back.status, "active")
})

test("ban covers duplicate profiles with the same email; lifting it restores them (never automatic)", async () => {
  const actor = await User.create({ firebaseUid: uid(), email: "sa2@example.com" })
  const a = await User.create({ firebaseUid: uid(), email: "twin@example.com", role: "moderator" })
  const b = await User.create({ firebaseUid: uid(), email: "TWIN@example.com", role: "customer" })
  await identity.banIdentity({ user: a, actor })
  assert.deepEqual((await User.find({ _id: { $in: [a._id, b._id] } }).lean()).map((u) => u.status), ["banned", "banned"])
  await identity.liftIdentityBan({ user: a, actor })
  assert.deepEqual((await User.find({ _id: { $in: [a._id, b._id] } }).lean()).map((u) => u.status), ["active", "active"])
  assert.equal(await AccountBan.countDocuments({ email: "twin@example.com", active: true }), 0)
  assert.equal(await AccountBan.countDocuments({ email: "twin@example.com", active: false }), 1, "history kept")
  assert.equal((await User.findById(a._id)).role, "moderator", "role unchanged by ban/unban")
})

test("the Super Admin keeps their role when signing in with a linked method", async () => {
  const { SystemConfig } = await import("../lib/models/SystemConfig.js")
  const pinned = uid()
  await SystemConfig.create({ key: "superadmin", firebaseUid: pinned, email: "boss@example.com" })
  const boss = await User.create({ firebaseUid: pinned, email: "boss@example.com", role: "administrator" })
  const g = google("boss@example.com")
  const profile = await signIn(g)
  assert.equal(String(profile._id), String(boss._id))
  assert.equal(await isProtectedSuperAdmin(profile), true)
  const { resolveSuperAdmin } = await import("../lib/access.js")
  assert.equal(await resolveSuperAdmin(g, profile), true)
  // …but a different person's Google account is not.
  const stranger = await signIn(google("stranger@example.com"))
  assert.equal(await resolveSuperAdmin(google("stranger@example.com", stranger.firebaseUid), stranger), false)
})
