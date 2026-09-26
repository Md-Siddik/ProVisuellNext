import mongoose from "mongoose"
import { registerModel } from "./registerModel.js"

// An email/password signup whose address hasn't been confirmed yet. Nothing
// is created in Firebase until the emailed link is opened (see
// lib/pendingSignup.js). The password is stored AES-256-GCM encrypted with a
// key that only exists inside the emailed link, so this collection alone
// can't reveal it. Documents expire on their own after 24 hours.
const pendingSignupSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, default: "" },
    // Cleared once the link has been used; the document then only records
    // that this address was confirmed (so a second click says so) until it expires.
    iv: { type: String, default: "" },
    tag: { type: String, default: "" },
    ciphertext: { type: String, default: "" },
    consumedAt: { type: Date, default: null },
    // SHA-256 of the link's key — lets a reused link be recognised (without
    // revealing anything to someone who only has the id) after the
    // ciphertext is gone.
    keyHash: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 },
  },
  { versionKey: false }
)

export const PendingSignup = registerModel("PendingSignup", pendingSignupSchema)
