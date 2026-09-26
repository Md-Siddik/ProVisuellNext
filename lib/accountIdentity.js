import { ApiError } from "./apiError.js"
import { AccountBan } from "./models/AccountBan.js"
import { User } from "./models/User.js"

// Who a verified Firebase sign-in is in ProVisuell, and whether they may be.
// The backend is the only place this is decided.
//
//   banned   Refused everywhere, for good: any sign-in method, any Firebase
//            account with the same email or a UID seen before, and signup.
//            Survives deletion of the profile. Only the Super Admin can lift it.
//   deleted  That profile is gone for good (its data and role are not
//            restored), but the person may sign up / sign in again and gets
//            a brand-new customer profile. (DeletedUser keeps a record of the
//            deletion; it doesn't block anything.)
//   active   A new sign-in method with the same verified email opens the same
//            profile (its UID is linked) — never a second profile.

export const BANNED_MESSAGE = "This account has been banned"

export function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase()
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
// Case-insensitive exact match on the stored email (older profiles kept it
// as Firebase reported it, sometimes with capitals).
export function emailQuery(email) {
  return { email: new RegExp(`^${escapeRegex(normalizeEmail(email))}$`, "i") }
}

export const bannedError = () => new ApiError(403, BANNED_MESSAGE, "ACCOUNT_BANNED")

// An active ban matching this email or any of these UIDs, or null.
export async function findActiveBan({ email, uids = [] }) {
  const or = []
  const normalized = normalizeEmail(email)
  if (normalized) or.push({ email: normalized })
  const ids = uids.filter(Boolean)
  if (ids.length) or.push({ firebaseUids: { $in: ids } })
  if (!or.length) return null
  return AccountBan.findOne({ active: true, $or: or }).lean()
}

export async function assertNotBanned(identity) {
  if (await findActiveBan(identity)) throw bannedError()
}

// The profile this Firebase identity already has (its own or a linked one).
export function findProfileByUid(uid) {
  return User.findOne({ $or: [{ firebaseUid: uid }, { linkedFirebaseUids: uid }] })
}

const allUids = (user) => [user.firebaseUid, ...(user.linkedFirebaseUids || [])].filter(Boolean)

// A verified Firebase sign-in with no profile yet: refuse it (banned), link
// it to the person's existing profile, or create a new one — in that order.
// Deleted profiles don't block: re-creating after deletion starts fresh.
//   decoded  the verified Firebase token
//   create   () => Promise<User>, the normal first-sign-in upsert
export async function resolveNewIdentity(decoded, { create }) {
  const uid = decoded.sub
  const email = normalizeEmail(decoded.email)

  // 1. Banned people never get in, and never get a new profile.
  await assertNotBanned({ email, uids: [uid] })

  // 2. Same person, other sign-in method: link to the existing profile. Only
  //    with an email the provider verified (Google always does), so nobody can
  //    claim a profile with an address they don't control.
  if (email && decoded.email_verified === true) {
    const candidates = await User.find(emailQuery(email)).sort({ createdAt: 1 })
    if (candidates.some((u) => u.status === "banned")) throw bannedError()
    const existing = candidates[0]
    if (existing) {
      await User.updateOne({ _id: existing._id }, { $addToSet: { linkedFirebaseUids: uid } })
      return findProfileByUid(uid)
    }
  }

  // 3. Brand new — including someone whose earlier profile was deleted: a
  //    fresh customer profile, nothing of the old one comes back.
  return create()
}

// Bans a person: every profile with their email, and a lasting ban record
// covering that email and all their Firebase UIDs.
export async function banIdentity({ user, actor, reason = "" }) {
  const email = normalizeEmail(user.email)
  const profiles = email ? await User.find(emailQuery(email)) : [user]
  if (!profiles.some((p) => String(p._id) === String(user._id))) profiles.push(user)
  const uids = [...new Set(profiles.flatMap(allUids))]
  const filter = email ? { email } : { firebaseUids: { $in: allUids(user) } }
  await AccountBan.findOneAndUpdate(
    { ...filter, active: true },
    {
      $setOnInsert: { email, bannedAt: new Date(), bannedBy: actor?._id || null, reason },
      $addToSet: { firebaseUids: { $each: uids }, userIds: { $each: profiles.map((p) => p._id) } },
    },
    { upsert: true, new: true }
  )
  const now = new Date()
  await User.updateMany(
    { _id: { $in: profiles.map((p) => p._id) } },
    { $set: { status: "banned", bannedAt: now, bannedBy: actor?._id || null, banReason: reason } }
  )
  return profiles
}

// Lifts the ban on this person (all their profiles and ban records).
export async function liftIdentityBan({ user, actor }) {
  const email = normalizeEmail(user.email)
  const or = [{ firebaseUids: { $in: allUids(user) } }, { userIds: user._id }]
  if (email) or.push({ email })
  await AccountBan.updateMany({ active: true, $or: or }, { $set: { active: false, liftedAt: new Date(), liftedBy: actor?._id || null } })
  const profiles = email ? await User.find({ ...emailQuery(email), status: "banned" }) : [user]
  await User.updateMany(
    { _id: { $in: [...new Set([...profiles.map((p) => String(p._id)), String(user._id)])] } },
    { $set: { status: "active", bannedAt: null, bannedBy: null, banReason: "" } }
  )
}
