import { NextResponse } from "next/server"
import { ApiError, roleForEmail, withApiErrors } from "@/lib/auth"
import { connectDB } from "@/lib/db"
import { User } from "@/lib/models/User"
import { PendingSignup } from "@/lib/models/PendingSignup"
import { createFirebaseUser, decryptPassword, parseToken } from "@/lib/pendingSignup"

// Email/password signup, step 2 of 2: the visitor opened the emailed link,
// so the address is confirmed. Only now is the account created in Firebase,
// and the Mongo profile is marked verified so it gets normal access.
export const POST = withApiErrors(async (request) => {
  const { token } = (await request.json().catch(() => ({}))) || {}
  const parsed = parseToken(token)
  if (!parsed) throw new ApiError(400, "This verification link is invalid or has expired")

  await connectDB()
  const pending = await PendingSignup.findById(parsed.pendingId)
  if (!pending) throw new ApiError(400, "This verification link is invalid or has expired")

  let password
  try {
    password = decryptPassword({ key: parsed.key, iv: pending.iv, tag: pending.tag, ciphertext: pending.ciphertext })
  } catch {
    throw new ApiError(400, "This verification link is invalid or has expired")
  }

  const origin = (process.env.CLIENT_URL || new URL(request.url).origin).replace(/\/$/, "")
  let uid
  try {
    ;({ uid } = await createFirebaseUser({ email: pending.email, password, name: pending.name, origin }))
  } catch (err) {
    if (err.firebaseCode === "EMAIL_EXISTS") {
      await PendingSignup.deleteOne({ _id: pending._id })
      throw new ApiError(409, "An account with this email already exists")
    }
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
  await PendingSignup.deleteOne({ _id: pending._id })

  return NextResponse.json({ ok: true, email: pending.email })
})
