import mongoose from "mongoose"
import { registerModel } from "./registerModel.js"

// Record of an account the Super Admin deleted (one per Firebase identity it
// had): who, when, by whom. It doesn't block anything — a deleted person may
// sign up again and gets a brand-new profile. Stopping someone for good is a
// ban (AccountBan, lib/accountIdentity.js), which deleting never removes.
const deletedUserSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true },
    email: { type: String, default: "" },
    name: { type: String, default: "" },
    role: { type: String, default: "" },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deletedByEmail: { type: String, default: "" },
  },
  { timestamps: { createdAt: "deletedAt", updatedAt: false }, versionKey: false }
)

export const DeletedUser = registerModel("DeletedUser", deletedUserSchema)
