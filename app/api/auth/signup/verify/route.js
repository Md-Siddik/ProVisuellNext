import { NextResponse } from "next/server"
import { ApiError, roleForEmail, withApiErrors } from "@/lib/auth"
import { connectDB } from "@/lib/db"
import { User } from "@/lib/models/User"
import { PendingSignup } from "@/lib/models/PendingSignup"
import { createFirebaseUser, decryptPassword, keyMatches, parseToken } from "@/lib/pendingSignup"
import { bannedError, findActiveBan } from "@/lib/accountIdentity"

// Email/password signup, step 2 of 2: the visitor opened the emailed link,
// so the address is confirmed. Only now is the account created in Firebase,
// and the Mongo profile is marked verified so it gets normal access.
export const POST = withApiErrors(async (request) => {
  const { token } = (await request.json().catch(() => ({}))) || {}
  const parsed = parseToken(token)
  if (!parsed) throw new ApiError(400, "This verification link is invalid or has expired")

  await connectDB()
  const pending = await PendingSignup.findById(parsed.pendingId)
  // Gone: never existed, or the 24-hour link expired (TTL removed it).
  if (!pending) throw new ApiError(400, "This verification link is invalid or has expired")
  // The whole link must match — an id alone reveals nothing. (Links issued
  // before keyHash existed are checked by the decryption below instead.)
  if (pending.keyHash && !keyMatches(parsed.key, pending.keyHash)) {
    throw new ApiError(400, "This verification link is invalid or has expired")
  }
  if (!pending.keyHash && pending.consumedAt) throw new ApiError(400, "This verification link is invalid or has expired")
  // Opened again after it already worked — the account exists; just say so.
  if (pending.consumedAt) return NextResponse.json({ ok: true, email: pending.email, alreadyVerified: true })
  // Banned after the link was sent (or a link sent before this check existed):
  // no Firebase account and no profile are created.
  if (await findActiveBan({ email: pending.email })) {
    await PendingSignup.deleteOne({ _id: pending._id })
    throw bannedError()
  }

  let password
  try {
    password = decryptPassword({ key: parsed.key, iv: pending.iv, tag: pending.tag, ciphertext: pending.ciphertext })
  } catch {
    throw new ApiError(400, "This verification link is invalid or has expired")
  }

  // Claim the link atomically so a double click can't create the account twice.
  const claimed = await PendingSignup.findOneAndUpdate({ _id: pending._id, consumedAt: null }, { $set: { consumedAt: new Date() } })
  if (!claimed) return NextResponse.json({ ok: true, email: pending.email, alreadyVerified: true })

  const origin = (process.env.CLIENT_URL || new URL(request.url).origin).replace(/\/$/, "")
  let uid
  try {
    ;({ uid } = await createFirebaseUser({ email: pending.email, password, name: pending.name, origin }))
  } catch (err) {
    if (err.firebaseCode === "EMAIL_EXISTS") {
      await PendingSignup.deleteOne({ _id: pending._id })
      throw new ApiError(409, "An account with this email already exists")
    }
    // Let the visitor retry the same link.
    await PendingSignup.updateOne({ _id: pending._id }, { $set: { consumedAt: null } })
    console.error("Firebase signup failed:", err.message)
    throw new ApiError(502, "Could not create the account right now")
  }

  const role = roleForEmail(pending.email)
  await User.findOneAndUpdate(
    { firebaseUid: uid },
    {
      $setOnInsert: { firebaseUid: uid, email: pending.email, name: pending.name, ...(role ? { role } : {}) },
      $set: { emailVerified: true },
    },
    { upsert: true, new: true }
  )
  // Keep only the "confirmed" marker; the encrypted password is discarded.
  await PendingSignup.updateOne({ _id: pending._id }, { $set: { iv: "", tag: "", ciphertext: "" } })

  return NextResponse.json({ ok: true, email: pending.email })
})
