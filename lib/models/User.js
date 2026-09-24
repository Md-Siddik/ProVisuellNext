import mongoose from "mongoose"

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: "" },
    email: { type: String, required: true },
    phone: { type: String, default: "" },
    // Set when the address was confirmed through our own signup link
    // (/api/auth/signup/verify) rather than Firebase's verification email.
    emailVerified: { type: Boolean, default: false },
    role: {
      type: String,
      enum: ["owner", "administrator", "customer"],
      default: "customer",
    },
  },
  { timestamps: true }
)

export const User = mongoose.models.User || mongoose.model("User", userSchema)
