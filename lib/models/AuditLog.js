import mongoose from "mongoose"
import { registerModel } from "./registerModel.js"

// Append-only trail of access-control changes (roles, permission overrides,
// role permission sets, account status). Readable by the Super Admin only.
const auditLogSchema = new mongoose.Schema(
  {
    // ADMIN_GRANTED, ADMIN_REMOVED, OWNER_GRANTED, OWNER_REMOVED,
    // MODERATOR_GRANTED, MODERATOR_REMOVED, ROLE_CHANGED, PERMISSION_GRANTED,
    // PERMISSION_DENIED, PERMISSION_RESTORED, PERMISSIONS_RESET,
    // ROLE_PERMISSIONS_UPDATED, ROLE_PERMISSIONS_RESET, USER_BANNED,
    // USER_UNBANNED, USER_DELETED
    action: { type: String, required: true },
    // Role permission changes: which role, and what was added / removed.
    role: { type: String, default: null },
    added: { type: [String], default: undefined },
    removed: { type: [String], default: undefined },
    // Ban reason, or other free-text context.
    detail: { type: String, default: "" },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorEmail: { type: String, default: "" },
    target: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    targetEmail: { type: String, default: "" },
    targetName: { type: String, default: "" },
    oldRole: { type: String, default: null },
    newRole: { type: String, default: null },
    permission: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
)

auditLogSchema.index({ createdAt: -1 })
auditLogSchema.index({ target: 1, createdAt: -1 })

export const AuditLog = registerModel("AuditLog", auditLogSchema)
