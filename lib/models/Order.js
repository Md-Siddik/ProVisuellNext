import mongoose from "mongoose"

// A single service/product line on an order. Kept minimal and self-
// contained (no computed fields stored here) — quantity*unitPrice and VAT
// are derived on read so there's never a stale line total to fix.
const orderItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    quantity: { type: Number, default: 1 },
    unit: { type: String, default: "stk" },
    unitPrice: { type: Number, default: 0 },
    vatRate: { type: Number, default: 25 },
  },
  { _id: false }
)

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, default: "" },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment", default: null },
    service: { type: String, required: true },
    specification: { type: String, required: true },
    // Itemized breakdown (optional — an order created before this feature,
    // or one deliberately kept simple, just has an empty array here).
    items: { type: [orderItemSchema], default: [] },
    discount: { type: Number, default: 0 },
    // subtotal/vatAmount/grandTotal are computed server-side from `items`
    // whenever items are present, and mirror `amount` when they aren't —
    // `amount` itself is untouched so every existing feature that reads it
    // (reports, notifications, the order tables) keeps working unchanged.
    subtotal: { type: Number, default: 0 },
    vatAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    expectedDeliveryDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "completed"],
      default: "pending",
      index: true,
    },
    source: {
      type: String,
      enum: ["meeting", "chat", "email", "admin"],
      default: "admin",
    },
    attachments: [
      {
        fileName: String,
        url: String,
        size: Number,
      },
    ],
    internalNote: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
    // Set only when status becomes "completed" — kept separate from
    // decidedAt so approval-month revenue attribution never shifts.
    completedAt: { type: Date, default: null },
    // Null until the customer has viewed this order after it was decided —
    // drives the "Min side" notification badge.
    customerSeenAt: { type: Date, default: null },
  },
  { timestamps: true }
)

export const Order = mongoose.models.Order || mongoose.model("Order", orderSchema)
