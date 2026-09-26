import mongoose from "mongoose"
import { registerModel } from "./registerModel.js"

// The Super Admin's permission set for one staff role (lib/permissions.js
// EDITABLE_ROLES). A role with no document here uses the code defaults
// (ROLE_DEFAULTS), so nothing changes until the Super Admin saves one.
// Written only through /api/superadmin/roles.
const rolePermissionSchema = new mongoose.Schema(
  {
    role: { type: String, required: true, unique: true },
    permissions: { type: [String], default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedByEmail: { type: String, default: "" },
  },
  { timestamps: true }
)

export const RolePermission = registerModel("RolePermission", rolePermissionSchema)
