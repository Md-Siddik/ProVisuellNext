import mongoose from "mongoose"

// The base weekly booking schedule — one document (key "default"). Each
// weekday holds the normalized "HH:MM" slot starts (Europe/Oslo) that are
// open by default; overrides (AvailabilityOverride) are applied on top.
// Future days are never stored — slots are calculated from these rules.
const day = { type: [String], default: undefined }

const availabilitySettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    timezone: { type: String, default: "Europe/Oslo" },
    slotIntervalMinutes: { type: Number, default: 30 },
    weeklySchedule: {
      monday: day,
      tuesday: day,
      wednesday: day,
      thursday: day,
      friday: day,
      saturday: day,
      sunday: day,
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
)

export const AvailabilitySettings =
  mongoose.models.AvailabilitySettings || mongoose.model("AvailabilitySettings", availabilitySettingsSchema)
