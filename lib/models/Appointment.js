import mongoose from "mongoose"

const appointmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    requestedByName: { type: String, required: true },
    requestedByEmail: { type: String, required: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    notes: { type: String, default: "" },
    // "completed" means the linked order has been decided (approved or
    // rejected) — the meeting has served its purpose, so it drops off the
    // customer's "Mine avtaler" list and its join link disappears.
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
)

export const Appointment = mongoose.models.Appointment || mongoose.model("Appointment", appointmentSchema)
