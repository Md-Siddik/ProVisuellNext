import mongoose from "mongoose"

// Double-booking guard. Every 30-minute slot a customer booking occupies gets
// one lock document; the unique index on slotStart means two bookings racing
// for the same slot can't both insert — the database rejects the second, no
// matter how close together they arrive. Locks are released when the
// appointment is cancelled.
const appointmentSlotLockSchema = new mongoose.Schema(
  {
    slotStart: { type: Date, required: true, unique: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", default: null },
    // Ties locks to one booking attempt so a failed attempt can clean up
    // exactly the locks it took.
    token: { type: String, required: true, index: true },
  },
  { timestamps: true, versionKey: false }
)

export const AppointmentSlotLock =
  mongoose.models.AppointmentSlotLock || mongoose.model("AppointmentSlotLock", appointmentSlotLockSchema)
