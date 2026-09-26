import mongoose from "mongoose"
import { registerModel } from "./registerModel.js"

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    // Other Firebase identities of the same person, linked by a verified
    // email (e.g. "Continue with Google" when the Firebase project keeps a
    // separate account per sign-in provider). They open this same profile —
    // never a second one. See lib/accountIdentity.js.
    linkedFirebaseUids: { type: [String], default: undefined, index: true },
    name: { type: String, default: "" },
    email: { type: String, required: true },
    phone: { type: String, default: "" },
    // Set when the address was confirmed through our own signup link
    // (/api/auth/signup/verify) rather than Firebase's verification email.
    emailVerified: { type: Boolean, default: false },
    // Display preference for appointment times ("12h" | "24h"). Presentation
    // only; null until the user picks one (the UI then defaults to 12h).
    timeFormat: { type: String, enum: ["12h", "24h", null], default: null },
    // Last language picked on the site — used for emails sent to this user.
    language: { type: String, enum: ["no", "en", "sv", "fi", "da", "ro", null], default: null },
    // Per-user overrides on top of the role's default permissions
    // (lib/permissions.js). Missing on older users = no overrides.
    permissionGrants: { type: [String], default: undefined },
    permissionDenies: { type: [String], default: undefined },
    // Account status, set by the Super Admin. A banned account is refused by
    // every authenticated API (lib/auth.js). Older users without the field
    // are active.
    status: { type: String, enum: ["active", "banned"], default: "active" },
    bannedAt: { type: Date, default: null },
    bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    banReason: { type: String, default: "" },
    role: {
      type: String,
      // "superadmin" is deliberately not a stored role — the Super Admin is
      // resolved from the server-side identity (lib/access.js), so no edit
      // to this field can grant or remove it.
      enum: ["owner", "administrator", "moderator", "customer"],
      default: "customer",
    },
  },
  { timestamps: true }
)

export const User = registerModel("User", userSchema)
