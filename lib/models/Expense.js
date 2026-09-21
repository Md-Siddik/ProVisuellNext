import mongoose from "mongoose"

const expenseSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    date: { type: Date, required: true },
    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

export const Expense = mongoose.models.Expense || mongoose.model("Expense", expenseSchema)
