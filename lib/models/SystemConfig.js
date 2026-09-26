import mongoose from "mongoose"
import { registerModel } from "./registerModel.js"

// Small key/value store for server-owned settings that must not live on an
// editable user document — currently the pinned Super Admin identity:
//   { key: "superadmin", firebaseUid, email, pinnedAt }
// Written once, by the server, the first time the configured
// SUPER_ADMIN_EMAIL signs in with a verified address. No API route writes it.
const systemConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    firebaseUid: { type: String, default: null },
    email: { type: String, default: null },
    pinnedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

export const SystemConfig = registerModel("SystemConfig", systemConfigSchema)
