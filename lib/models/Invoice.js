import mongoose from "mongoose"
import { registerModel } from "./registerModel.js"

// A snapshot of one order line at the moment the invoice was issued — never
// re-read from the order afterwards, so later edits to the order (price
// changes, corrections) can never retroactively change a real invoice.
const invoiceItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    quantity: { type: Number, required: true, default: 1 },
    unit: { type: String, default: "stk" },
    unitPrice: { type: Number, required: true, default: 0 },
    vatRate: { type: Number, default: 25 },
    subtotal: { type: Number, required: true, default: 0 }, // quantity * unitPrice, frozen at issue time
  },
  { _id: false }
)

const partySchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    orgNumber: { type: String, default: "" },
    address: { type: String, default: "" },
    postalCode: { type: String, default: "" },
    city: { type: String, default: "" },
    country: { type: String, default: "Norge" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    website: { type: String, default: "" },
    vatRegistered: { type: Boolean, default: true },
  },
  { _id: false }
)

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, index: true },
    // Optional because a "statement" invoice (see `type` below) rolls up
    // several orders' worth of unpaid invoices into one document instead
    // of billing a single order.
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null, index: true },
    orderNumber: { type: String, default: "" },
    // A normal invoice bills one completed order. A "statement" is a
    // reminder invoice generated from Kundebetalinger, covering everything
    // a customer currently owes across multiple orders in one document —
    // sourceInvoiceIds tracks which underlying invoices it consolidates.
    type: { type: String, enum: ["order", "statement"], default: "order" },
    sourceInvoiceIds: { type: [mongoose.Schema.Types.ObjectId], ref: "Invoice", default: [] },
    // Null for a walk-in/manually-registered customer without an account —
    // access control on customer-facing routes falls back to email match.
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },

    seller: { type: partySchema, default: () => ({}) },
    customer: { type: partySchema, default: () => ({}) },

    issueDate: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date, required: true },
    deliveryDate: { type: Date, default: null },
    deliveryPlace: { type: String, default: "" },

    items: { type: [invoiceItemSchema], default: [] },

    subtotal: { type: Number, required: true, default: 0 },
    discount: { type: Number, default: 0 },
    vatAmount: { type: Number, required: true, default: 0 },
    grandTotal: { type: Number, required: true, default: 0 },

    payment: {
      bankAccount: { type: String, default: "" },
      kid: { type: String, default: "" },
      iban: { type: String, default: "" },
      swift: { type: String, default: "" },
      paymentReference: { type: String, default: "" },
    },
    paymentTerms: { type: String, default: "" },
    note: { type: String, default: "" },

    amountPaid: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["draft", "issued", "unpaid", "partially_paid", "paid", "overdue", "cancelled"],
      default: "unpaid",
      index: true,
    },

    sentAt: { type: Date, default: null },
    // Set the moment status first becomes "paid" — lets reports recognize
    // revenue when cash actually came in, not when the invoice was issued.
    paidAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

export const Invoice = registerModel("Invoice", invoiceSchema)
