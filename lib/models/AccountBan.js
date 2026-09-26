import mongoose from "mongoose"
import { registerModel } from "./registerModel.js"

// A ban on a person, not just on one profile. The User document's `status`
// stops an existing profile; this record is what stops the same person from
// coming back — by a new sign-in method (Google after email/password or the
// other way round), a new Firebase account, or after their profile was
// deleted. Matched by normalized email or any of their Firebase UIDs
// (lib/accountIdentity.js). Never removed: lifting a ban sets active=false.
const accountBanSchema = new mongoose.Schema(
  {
    // Lowercased, trimmed. Empty only for an identity that had no email.
    email: { type: String, default: "" },
    firebaseUids: { type: [String], default: [] },
    userIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    active: { type: Boolean, default: true },
    reason: { type: String, default: "" },
    bannedAt: { type: Date, default: Date.now },
    bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    liftedAt: { type: Date, default: null },
    liftedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
)

accountBanSchema.index({ email: 1, active: 1 })
accountBanSchema.index({ firebaseUids: 1, active: 1 })

export const AccountBan = registerModel("AccountBan", accountBanSchema)
