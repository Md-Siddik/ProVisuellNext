import mongoose from "mongoose"
import { registerModel } from "./registerModel.js"

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

export const Expense = registerModel("Expense", expenseSchema)
