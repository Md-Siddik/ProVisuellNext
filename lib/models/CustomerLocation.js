import mongoose from "mongoose"
import { registerModel } from "./registerModel.js"

// One saved location per order — a single browser-geolocation share, not a
// live-tracked position. `customerName`/`customerEmail` are denormalized
// copies of the User doc at save time (never client-supplied) so the staff
// list never has to join back to User just to show who a row belongs to.
// `order` is unique — sharing again for the same order updates the existing
// row (upsert) rather than creating a second one.
const customerLocationSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, default: "" },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true },

    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    locationAccuracy: { type: Number, default: null },
    // The GPS reading's own timestamp (from the winning watchPosition
    // sample), distinct from `updatedAt` (when it was written to the DB) —
    // the two can differ by several seconds since the client collects
    // multiple readings over ~10-15s before confirming the best one.
    locatedAt: { type: Date, default: null },
    source: { type: String, default: "current_location" },

    // An external Google Maps share link the customer already has, offered
    // as a link-only fallback — never scraped, never a coordinate source.
    // Validated server-side before saving.
    googleMapsShareUrl: { type: String, default: "" },
  },
  { timestamps: true }
)

export const CustomerLocation = registerModel("CustomerLocation", customerLocationSchema)
