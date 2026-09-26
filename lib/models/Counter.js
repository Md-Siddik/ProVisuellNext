import mongoose from "mongoose"
import { registerModel } from "./registerModel.js"

// Backs sequential, gap-free document numbers (order/invoice numbers).
// Deliberately NOT derived from Order.countDocuments()/Invoice.countDocuments()
// — that scheme breaks the moment any document is ever deleted (a lower
// count reissues an already-used number and collides with the surviving
// document's unique index). This counter only ever increments, and the
// increment itself is atomic ($inc via findOneAndUpdate), so it's also
// race-safe under concurrent requests.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "order-2026", "invoice-2026"
  seq: { type: Number, default: 0 },
})

export const Counter = registerModel("Counter", counterSchema)
