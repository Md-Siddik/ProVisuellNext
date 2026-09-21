import mongoose from "mongoose"

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: "" },
    email: { type: String, required: true },
    phone: { type: String, default: "" },
    role: {
      type: String,
      enum: ["owner", "administrator", "customer"],
      default: "customer",
    },
  },
  { timestamps: true }
)

export const User = mongoose.models.User || mongoose.model("User", userSchema)
