import mongoose from "mongoose"

// An email/password signup whose address hasn't been confirmed yet. Nothing
// is created in Firebase until the emailed link is opened (see
// lib/pendingSignup.js). The password is stored AES-256-GCM encrypted with a
// key that only exists inside the emailed link, so this collection alone
// can't reveal it. Documents expire on their own after 24 hours.
const pendingSignupSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, default: "" },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    ciphertext: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 },
  },
  { versionKey: false }
)

export const PendingSignup = mongoose.models.PendingSignup || mongoose.model("PendingSignup", pendingSignupSchema)
