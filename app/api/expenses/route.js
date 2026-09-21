import { NextResponse } from "next/server"
import { authenticate, requireRole, withApiErrors, ApiError } from "@/lib/auth"
import { Expense } from "@/lib/models/Expense"

export const GET = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  requireRole(user, ["administrator", "owner"])

  const params = new URL(request.url).searchParams
  const from = params.get("from")
  const to = params.get("to")
  const query = {}
  if (from || to) {
    query.date = {}
    if (from) query.date.$gte = new Date(from)
    if (to) query.date.$lte = new Date(to)
  }
  const expenses = await Expense.find(query).sort({ date: -1 })
  return NextResponse.json({ expenses })
})

export const POST = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  requireRole(user, ["administrator", "owner"])

  const { amount, category, date, note } = (await request.json().catch(() => ({}))) || {}
  if (!amount || !category || !date) {
    throw new ApiError(400, "amount, category and date are required")
  }
  const expense = await Expense.create({ amount, category, date, note: note || "", createdBy: user._id })
  return NextResponse.json({ expense }, { status: 201 })
})
