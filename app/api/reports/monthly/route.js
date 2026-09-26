import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { Invoice } from "@/lib/models/Invoice"
import { computeInvoiceStatus } from "@/lib/invoices/status"
import { Expense } from "@/lib/models/Expense"

// Anything short of actually paid or cancelled still owes money.
const DUE_STATUSES = ["draft", "issued", "unpaid", "partially_paid", "overdue"]

function monthRange(monthStr) {
  const [y, m] = monthStr.split("-").map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 1))
  return { start, end }
}

function prevMonthStr(monthStr) {
  const [y, m] = monthStr.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 2, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

// Revenue is recognized when a customer actually pays, not when an order
// is merely approved — that's the only number a "Totale inntekter" figure
// can mean once real invoices and payment tracking exist. Statement
// invoices (Kundebetalinger reminders) are excluded everywhere here: they
// re-bill debt that's already counted on the original per-order invoice,
// so counting them too would double the numbers.
async function totalsFor(monthStr) {
  const { start, end } = monthRange(monthStr)

  const [paidInvoices, expenses] = await Promise.all([
    Invoice.find({ type: { $ne: "statement" }, status: "paid", paidAt: { $gte: start, $lt: end } }).populate(
      "orderId",
      "service"
    ),
    Expense.find({ date: { $gte: start, $lt: end } }),
  ])

  const revenue = paidInvoices.reduce((sum, i) => sum + i.grandTotal, 0)
  // Direct costs pull gross profit down from revenue; everything else
  // (operating expenses) pulls net result down from gross profit.
  const directCosts = expenses
    .filter((e) => e.category === "Direkte kostnader")
    .reduce((sum, e) => sum + e.amount, 0)
  const otherCosts = expenses
    .filter((e) => e.category !== "Direkte kostnader")
    .reduce((sum, e) => sum + e.amount, 0)
  const totalCosts = directCosts + otherCosts
  const grossProfit = revenue - directCosts
  const netResult = grossProfit - otherCosts

  return { revenue, totalCosts, grossProfit, netResult, paidInvoices, expenses }
}

function pctChange(current, previous) {
  if (!previous) return current ? 100 : 0
  return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1))
}

export const GET = withApiErrors(async (request) => {
  requirePermission(await authenticate(request), "reports.view")

  const month = new URL(request.url).searchParams.get("month") || new Date().toISOString().slice(0, 7)
  const [current, previous] = await Promise.all([totalsFor(month), totalsFor(prevMonthStr(month))])

  // Everything currently outstanding across all customers — a live
  // balance, not scoped to this month, since money owed doesn't belong to
  // any one period.
  const dueInvoices = await Invoice.find({ type: { $ne: "statement" }, status: { $in: DUE_STATUSES } })
  const dueTotal = dueInvoices.reduce((sum, i) => sum + Math.max(0, i.grandTotal - (i.amountPaid || 0)), 0)

  // Daily paid-revenue vs. cost breakdown for the bar chart, plus a
  // per-day gross/net split so the KPI sparklines reflect real numbers.
  const dailyMap = new Map()
  const dayEntry = (day) => {
    let entry = dailyMap.get(day)
    if (!entry) {
      entry = { date: day, revenue: 0, cost: 0, directCost: 0, otherCost: 0 }
      dailyMap.set(day, entry)
    }
    return entry
  }
  for (const inv of current.paidInvoices) {
    const entry = dayEntry(inv.paidAt.toISOString().slice(0, 10))
    entry.revenue += inv.grandTotal
  }
  for (const e of current.expenses) {
    const entry = dayEntry(e.date.toISOString().slice(0, 10))
    entry.cost += e.amount
    if (e.category === "Direkte kostnader") entry.directCost += e.amount
    else entry.otherCost += e.amount
  }
  const daily = [...dailyMap.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => ({
      ...entry,
      grossProfit: entry.revenue - entry.directCost,
      netResult: entry.revenue - entry.directCost - entry.otherCost,
    }))

  // Revenue split by service — which of the three pillars actually got
  // paid for this month, not just quoted.
  const byService = new Map()
  for (const inv of current.paidInvoices) {
    const service = inv.orderId?.service || "Annet"
    byService.set(service, (byService.get(service) || 0) + inv.grandTotal)
  }
  const revenueByService = [...byService.entries()]
    .map(([service, amount]) => ({
      service,
      amount,
      percent: current.revenue ? Number(((amount / current.revenue) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  return NextResponse.json({
    month,
    totals: {
      revenue: current.revenue,
      costs: current.totalCosts,
      grossProfit: current.grossProfit,
      netResult: current.netResult,
      due: dueTotal,
    },
    changeVsPrevMonth: {
      revenue: pctChange(current.revenue, previous.revenue),
      costs: pctChange(current.totalCosts, previous.totalCosts),
      grossProfit: pctChange(current.grossProfit, previous.grossProfit),
      netResult: pctChange(current.netResult, previous.netResult),
    },
    previous: {
      revenue: previous.revenue,
      costs: previous.totalCosts,
      grossProfit: previous.grossProfit,
      netResult: previous.netResult,
    },
    daily,
    revenueByService,
    dueInvoiceCount: dueInvoices.length,
    dueInvoices: dueInvoices
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .map((i) => ({
        _id: i._id,
        invoiceNumber: i.invoiceNumber,
        orderNumber: i.orderNumber,
        customerName: i.customer?.name || "Ukjent kunde",
        amount: Math.max(0, i.grandTotal - (i.amountPaid || 0)),
        dueDate: i.dueDate,
        status: computeInvoiceStatus(i),
      })),
    updatedAt: new Date().toISOString(),
  })
})
