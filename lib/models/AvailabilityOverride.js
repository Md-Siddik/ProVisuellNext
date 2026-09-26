import mongoose from "mongoose"
import { registerModel } from "./registerModel.js"

// One availability rule layered over the weekly schedule — e.g. "close
// 2026-12-25 all day", "every Monday 14:30 unavailable", or "open 07:00 on
// 2026-10-05". Dates are plain Oslo calendar dates ("YYYY-MM-DD"), times are
// normalized "HH:MM" slot starts. Rules are never destructive: they can be
// edited, switched off (active: false) or deleted at any time.
// See lib/appointments/rules.js for how they're resolved.
const availabilityOverrideSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["single_date", "date_range", "week", "month", "weekly_recurring", "indefinite"],
      required: true,
    },
    startDate: { type: String, default: null },
    endDate: { type: String, default: null },
    // 0 = Monday … 6 = Sunday (weekly_recurring only).
    daysOfWeek: { type: [Number], default: [] },
    allDay: { type: Boolean, default: false },
    startTime: { type: String, default: null },
    endTime: { type: String, default: null },
    slotTimes: { type: [String], default: [] },
    available: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
)

availabilityOverrideSchema.index({ active: 1, startDate: 1, endDate: 1 })

export const AvailabilityOverride =
  registerModel("AvailabilityOverride", availabilityOverrideSchema)
