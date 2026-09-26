import mongoose from "mongoose"
import { registerModel } from "./registerModel.js"

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
    // Attendance = the booked attendee pressed "Join" (recorded server-side
    // before the Meet link opens). This is the Join action, not verified
    // Google Meet presence. "missed" is derived once the meeting has ended
    // without a join (lib/appointments/attendance.js), so it's never stale.
    joinClicked: { type: Boolean, default: false },
    joinedAt: { type: Date, default: null },
    joinedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    attendanceStatus: { type: String, enum: ["scheduled", "joined"], default: "scheduled" },
    // The meeting URL, kept out of every query by default (select: false) —
    // only the join endpoint reads it, and only inside the join window. Older
    // appointments without one fall back to the configured room link.
    meetingUrl: { type: String, default: "", select: false },
    // Reschedule / cancel history (the same document is moved, never duplicated).
    previousStart: { type: Date, default: null },
    rescheduledAt: { type: Date, default: null },
    rescheduleCount: { type: Number, default: 0 },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
)

// Calendar week queries, the per-customer list and overlap checks.
appointmentSchema.index({ start: 1, end: 1 })
appointmentSchema.index({ requestedBy: 1, start: 1 })

export const Appointment = registerModel("Appointment", appointmentSchema)
