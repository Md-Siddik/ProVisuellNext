// The one place invoice amounts and payment status are derived — used by the
// API (stored status + responses), the invoice view/PDF and the invoice
// email, so they can never disagree. Dependency-free (runs in both).
//
//   balance <= 0                                → paid     (tag PAID)
//   balance > 0 and the due date has passed     → overdue  (tag OVERDUE)
//   balance > 0 and something already paid      → partially_paid (tag DUE)
//   balance > 0 and nothing paid                → unpaid   (tag UNPAID)
// "cancelled" and "draft" are explicit states and are kept as they are.
// Example: total 10 000, paid 3 000 → remaining 7 000 → DUE, not UNPAID.

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

export const STATUS_TAG = {
  unpaid: "UNPAID",
  issued: "UNPAID",
  partially_paid: "DUE",
  overdue: "OVERDUE",
  paid: "PAID",
  cancelled: "CANCELLED",
  draft: "DRAFT",
}

export function invoiceAmounts(invoice) {
  const total = round2(invoice?.grandTotal)
  const paid = round2(Math.max(0, Number(invoice?.amountPaid) || 0))
  const balance = round2(Math.max(0, total - paid))
  return { total, paid, balance }
}

// Due date counts as passed once its whole Oslo calendar day is over.
function osloDay(value) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value))
}

export function isPastDue(invoice, now = new Date()) {
  if (!invoice?.dueDate) return false
  const due = new Date(invoice.dueDate)
  if (Number.isNaN(due.getTime())) return false
  return osloDay(now) > osloDay(due)
}

export function computeInvoiceStatus(invoice, now = new Date()) {
  if (invoice?.status === "cancelled" || invoice?.status === "draft") return invoice.status
  const { paid, balance } = invoiceAmounts(invoice)
  if (balance <= 0) return "paid"
  if (isPastDue(invoice, now)) return "overdue"
  if (paid > 0) return "partially_paid"
  return "unpaid"
}

export function invoiceStatusTag(invoice, now = new Date()) {
  return STATUS_TAG[computeInvoiceStatus(invoice, now)] || "UNPAID"
}

// A response-ready copy with the derived status and amounts filled in.
export function withInvoiceStatus(invoice, now = new Date()) {
  const plain = typeof invoice?.toObject === "function" ? invoice.toObject() : { ...invoice }
  const { paid, balance } = invoiceAmounts(plain)
  return { ...plain, status: computeInvoiceStatus(plain, now), amountPaid: paid, balanceDue: balance }
}
