import { NextResponse } from "next/server"
import { authenticate, requireRole, withApiErrors } from "@/lib/auth"
import { Invoice } from "@/lib/models/Invoice"

// Any status short of actually paid or cancelled still owes money.
const DUE_STATUSES = ["draft", "issued", "unpaid", "partially_paid", "overdue"]

// One row per customer — how many invoices they've paid vs. how many are
// still outstanding, and the invoices behind that "due" count, so owner/
// admin can spot who pays reliably and who's piling up unpaid invoices
// without paging through every invoice individually.
export const GET = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  requireRole(user, ["administrator", "owner"])

  // Statement invoices (see createStatementInvoice) are a rollup of debt
  // that's already counted via the underlying per-order invoices — counting
  // them too would make the due total climb every time "Påminn" is clicked,
  // for the exact same outstanding amount.
  const invoices = await Invoice.find({ type: { $ne: "statement" } })
    .select("customerId customer orderNumber invoiceNumber status grandTotal amountPaid dueDate issueDate")
    .sort({ issueDate: -1 })

  const groups = new Map()
  for (const inv of invoices) {
    const key = inv.customerId ? String(inv.customerId) : `email:${inv.customer?.email || "ukjent"}`
    if (!groups.has(key)) {
      groups.set(key, {
        customerId: inv.customerId || null,
        customerEmail: inv.customer?.email || "",
        customerName: inv.customer?.name || "Ukjent kunde",
        totalInvoices: 0,
        paidCount: 0,
        dueCount: 0,
        dueAmount: 0,
        dueInvoices: [],
      })
    }
    const group = groups.get(key)
    group.totalInvoices += 1
    if (inv.status === "paid") group.paidCount += 1
    if (DUE_STATUSES.includes(inv.status)) {
      const remaining = Math.max(0, inv.grandTotal - (inv.amountPaid || 0))
      group.dueCount += 1
      group.dueAmount += remaining
      group.dueInvoices.push({
        _id: inv._id,
        invoiceNumber: inv.invoiceNumber,
        orderNumber: inv.orderNumber,
        amount: remaining,
        dueDate: inv.dueDate,
        status: inv.status,
      })
    }
  }

  const customers = Array.from(groups.values()).sort(
    (a, b) => b.dueCount - a.dueCount || b.dueAmount - a.dueAmount
  )
  return NextResponse.json({ customers })
})
