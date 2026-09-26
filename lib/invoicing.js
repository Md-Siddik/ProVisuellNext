import { Invoice } from "./models/Invoice.js"
import { ApiError } from "./apiError.js"
import { can } from "./access.js"

// Shared by app/api/invoices/[id] and app/api/invoices/by-order/[orderId]:
// your own invoice, or any invoice with invoices.view.
export function assertOwnInvoice(auth, invoice) {
  if (String(invoice.customerId) !== String(auth.user._id) && !can(auth, "invoices.view")) {
    throw new ApiError(403, "Not your invoice")
  }
}

// Not collected from the user anywhere yet — safe, real defaults matching
// the public site's own footer, overridable later via env if a real org
// number is added.
export const SELLER_DEFAULTS = {
  name: "ProVisuell AS",
  orgNumber: process.env.SELLER_ORG_NUMBER || "",
  address: "Stortelia 7",
  postalCode: "0250",
  city: "Oslo",
  country: "Norge",
  email: process.env.BUSINESS_EMAIL || "info@provisuell.no",
  website: "www.provisuell.no",
  vatRegistered: true,
}

export async function nextInvoiceNumber() {
  const year = new Date().getFullYear()
  const count = await Invoice.countDocuments({
    createdAt: { $gte: new Date(`${year}-01-01`), $lt: new Date(`${year + 1}-01-01`) },
  })
  return `INV-${year}-${String(count + 1).padStart(6, "0")}`
}

const DEFAULT_DUE_DAYS = 14

// Issues an invoice from a completed order — snapshots the customer + items
// + totals as they stand right now, so any later edit to the order never
// touches an already-issued invoice again. Shared by the manual "Opprett
// faktura" form and the automatic invoice created the moment an order is
// marked completed.
export async function createInvoiceFromOrder(order, options = {}) {
  const {
    dueDate,
    deliveryDate,
    deliveryPlace = "",
    discount,
    paymentTerms,
    note = "",
    payment = {},
    createdBy = null,
  } = options

  // An order saved before the itemized-service feature (or one kept
  // deliberately simple) has no items — fall back to a single line built
  // from its service/amount so every order can still be invoiced.
  const items = order.items?.length
    ? order.items.map((i) => ({
        name: i.name,
        description: i.description || "",
        quantity: i.quantity,
        unit: i.unit || "stk",
        unitPrice: i.unitPrice,
        vatRate: i.vatRate,
        subtotal: i.quantity * i.unitPrice,
      }))
    : [
        {
          name: order.service,
          description: order.specification || "",
          quantity: 1,
          unit: "stk",
          unitPrice: order.amount || 0,
          vatRate: 25,
          subtotal: order.amount || 0,
        },
      ]

  // Never trust a client-sent total for money — recompute from the
  // snapshotted lines server-side, same formula the invoice view itself
  // uses to render.
  const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0)
  const discountAmount = Math.max(0, Number(discount) || 0)
  const taxableAmount = Math.max(0, subtotal - discountAmount)
  const vatAmount = items.reduce((sum, i) => sum + i.subtotal * (Number(i.vatRate ?? 25) / 100), 0)
  const grandTotal = taxableAmount + vatAmount

  const resolvedDueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + DEFAULT_DUE_DAYS * 86400000)

  return Invoice.create({
    invoiceNumber: await nextInvoiceNumber(),
    orderId: order._id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    seller: SELLER_DEFAULTS,
    customer: {
      name: order.customerName,
      email: order.customerEmail || "",
    },
    issueDate: new Date(),
    dueDate: resolvedDueDate,
    deliveryDate: deliveryDate ? new Date(deliveryDate) : order.expectedDeliveryDate || null,
    deliveryPlace,
    items,
    subtotal,
    discount: discountAmount,
    vatAmount,
    grandTotal,
    payment,
    paymentTerms: paymentTerms || "Betales innen forfallsdato.",
    note,
    status: "unpaid",
    createdBy,
  })
}

// Rolls up everything a customer currently owes — across however many
// separate orders — into one real, sendable invoice document. Distinct
// from createInvoiceFromOrder above (which always bills exactly one
// completed order); this is only ever triggered from the Kundebetalinger
// payment-reminder flow and never touches the per-order invoice buttons.
export async function createStatementInvoice({ customerId, customerEmail, customerName, dueInvoices, createdBy }) {
  const items = dueInvoices.map((inv) => ({
    name: `Faktura ${inv.invoiceNumber}${inv.orderNumber ? ` (Ordre #${inv.orderNumber})` : ""}`,
    description: "",
    quantity: 1,
    unit: "stk",
    // The remaining balance already includes VAT from the original
    // invoice — treating it as a fresh vatRate-25% line here would tax it
    // twice, so this line carries no additional VAT of its own.
    unitPrice: inv.amount,
    vatRate: 0,
    subtotal: inv.amount,
  }))

  const grandTotal = items.reduce((sum, i) => sum + i.subtotal, 0)

  return Invoice.create({
    invoiceNumber: await nextInvoiceNumber(),
    type: "statement",
    sourceInvoiceIds: dueInvoices.map((inv) => inv._id),
    customerId: customerId || null,
    seller: SELLER_DEFAULTS,
    customer: { name: customerName || "", email: customerEmail || "" },
    issueDate: new Date(),
    dueDate: new Date(Date.now() + DEFAULT_DUE_DAYS * 86400000),
    items,
    subtotal: grandTotal,
    discount: 0,
    vatAmount: 0,
    grandTotal,
    payment: {},
    paymentTerms: "Betales innen forfallsdato.",
    note: "Samlefaktura for utestående fakturaer.",
    status: "unpaid",
    createdBy,
  })
}
