import mongoose from "mongoose"

const messageSchema = new mongoose.Schema(
  {
    sender: { type: String, enum: ["user", "admin", "system"], required: true },
    text: { type: String, required: true },
    time: { type: Date, default: Date.now },
  },
  { _id: true }
)

const conversationSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    customerName: { type: String, default: "" },
    customerEmail: { type: String, default: "" },
    messages: [messageSchema],
    lastMessageAt: { type: Date, default: Date.now },
    // Set true the moment the OTHER side sends a message; cleared when the
    // owning side actually opens the conversation (or replies to it).
    unreadForAdmin: { type: Boolean, default: false },
    unreadForCustomer: { type: Boolean, default: false },
    // How many unread messages are waiting for each side — powers the
    // counting badge (1, 2, 3…) on the Meldinger icon. Mongoose schemas are
    // strict by default, so these must be declared here or every write to
    // them from routes/messages.js is silently dropped on save.
    unreadAdminCount: { type: Number, default: 0 },
    unreadCustomerCount: { type: Number, default: 0 },
    // Last time each side typed, used to show a "typing…" indicator to the
    // other party. Not a message — just a timestamp the poller checks for
    // recency (see routes/messages.js).
    typing: {
      user: { type: Date, default: null },
      admin: { type: Date, default: null },
    },
  },
  { timestamps: true }
)

export const Conversation = mongoose.models.Conversation || mongoose.model("Conversation", conversationSchema)
