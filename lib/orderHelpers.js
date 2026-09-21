// Shared by app/api/orders/route.js and app/api/orders/[id]/status/route.js.
// Ported verbatim from Server/src/routes/orders.js's own top-of-file helpers
// — split out only because Next.js Route Handlers are one file per URL, so
// these can no longer just be private functions inside a single routes file.
import { sendEmail, notifyBusiness } from "./mailer"
import { nextInSequence } from "./sequence"

// Cleans and totals a raw items array from the client. Money is always
// recomputed here from the cleaned numbers — a client-sent subtotal/VAT/
// total is never trusted or stored directly.
export function buildItemTotals(rawItems) {
  const items = (Array.isArray(rawItems) ? rawItems : [])
    .filter((i) => i && String(i.name || "").trim())
    .map((i) => ({
      name: String(i.name).trim(),
      description: String(i.description || "").trim(),
      quantity: Math.max(0, Number(i.quantity) || 0),
      unit: String(i.unit || "stk").trim() || "stk",
      unitPrice: Math.max(0, Number(i.unitPrice) || 0),
      vatRate: Number(i.vatRate) >= 0 ? Number(i.vatRate) : 25,
    }))

  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
  const vatAmount = items.reduce((sum, i) => sum + i.quantity * i.unitPrice * (i.vatRate / 100), 0)
  return { items, subtotal, vatAmount }
}

export async function nextOrderNumber() {
  const year = new Date().getFullYear()
  const seq = await nextInSequence(`order-${year}`)
  return `PV-${year}-${String(seq).padStart(6, "0")}`
}

// Best-effort — silently does nothing until SMTP_HOST/SMTP_USER/SMTP_PASS
// are set in .env (see lib/mailer.js). Never throws.
export async function notifyCustomerOfDecision(order) {
  if (!order.customerEmail) return
  const copy = {
    approved: {
      verb: "godkjent",
      text: `Hei ${order.customerName},\n\nBestillingen din (${order.orderNumber} – ${order.service}) er godkjent. Vi setter i gang med leveransen.\n\nMvh ProVisuell`,
    },
    rejected: {
      verb: "avvist",
      text: `Hei ${order.customerName},\n\nBestillingen din (${order.orderNumber} – ${order.service}) kunne dessverre ikke godkjennes. Ta kontakt med oss, så finner vi en løsning.\n\nMvh ProVisuell`,
    },
    completed: {
      verb: "fullført",
      text: `Hei ${order.customerName},\n\nBestillingen din (${order.orderNumber} – ${order.service}) er nå fullført og levert. Takk for at du valgte ProVisuell!\n\nMvh ProVisuell`,
    },
  }[order.status]
  if (!copy) return
  await sendEmail({
    to: order.customerEmail,
    subject: `Din bestilling ${order.orderNumber} er ${copy.verb}`,
    text: copy.text,
  })
}

// Order-received confirmation to the customer, and a heads-up to the
// business inbox — both best-effort, same as the decision email above.
export async function notifyOrderCreated(order) {
  if (order.customerEmail) {
    await sendEmail({
      to: order.customerEmail,
      subject: `Vi har mottatt bestillingen din ${order.orderNumber}`,
      text: `Hei ${order.customerName},\n\nVi har mottatt bestillingen din (${order.orderNumber} – ${order.service}). Vi tar kontakt så snart den er behandlet.\n\nMvh ProVisuell`,
    })
  }
  await notifyBusiness({
    subject: `Ny bestilling ${order.orderNumber} — ${order.customerName}`,
    text: `Kunde: ${order.customerName}\nE-post: ${order.customerEmail || "—"}\nTjeneste: ${order.service}\nBeskrivelse: ${order.specification}\nOrdrenr: ${order.orderNumber}\nBeløp: ${order.grandTotal} kr`,
  })
}
