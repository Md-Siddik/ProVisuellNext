// Invoice status rule + the full invoice email. Pure; no DB, no SMTP.
import test from "node:test"
import assert from "node:assert/strict"
import { computeInvoiceStatus, invoiceAmounts, invoiceStatusTag, withInvoiceStatus } from "../lib/invoices/status.js"
import { renderInvoiceEmail } from "../lib/invoices/email.js"

const now = new Date("2026-09-25T10:00:00Z")
const future = "2026-10-09T10:00:00Z"
const past = "2026-09-20T10:00:00Z"
const inv = (o) => ({ status: "unpaid", grandTotal: 10000, amountPaid: 0, dueDate: future, ...o })

test("0 paid → UNPAID", () => {
  assert.equal(computeInvoiceStatus(inv({}), now), "unpaid")
  assert.equal(invoiceStatusTag(inv({}), now), "UNPAID")
})

test("partial (10 000 total, 3 000 paid) → DUE, remaining 7 000", () => {
  const i = inv({ amountPaid: 3000 })
  assert.equal(computeInvoiceStatus(i, now), "partially_paid")
  assert.equal(invoiceStatusTag(i, now), "DUE")
  assert.deepEqual(invoiceAmounts(i), { total: 10000, paid: 3000, balance: 7000 })
})

test("fully paid (or overpaid) → PAID", () => {
  assert.equal(invoiceStatusTag(inv({ amountPaid: 10000 }), now), "PAID")
  assert.equal(invoiceStatusTag(inv({ amountPaid: 12000 }), now), "PAID")
  assert.equal(invoiceAmounts(inv({ amountPaid: 12000 })).balance, 0)
})

test("overdue takes priority while a balance remains; paid never becomes overdue", () => {
  assert.equal(invoiceStatusTag(inv({ dueDate: past }), now), "OVERDUE")
  assert.equal(invoiceStatusTag(inv({ dueDate: past, amountPaid: 3000 }), now), "OVERDUE")
  assert.equal(invoiceStatusTag(inv({ dueDate: past, amountPaid: 10000 }), now), "PAID")
  // Due today isn't overdue until the Oslo day is over.
  assert.equal(invoiceStatusTag(inv({ dueDate: "2026-09-25T06:00:00Z" }), now), "UNPAID")
})

test("stored status is ignored except cancelled/draft", () => {
  assert.equal(computeInvoiceStatus(inv({ status: "paid", amountPaid: 0 }), now), "unpaid") // stale label
  assert.equal(computeInvoiceStatus(inv({ status: "unpaid", amountPaid: 3000 }), now), "partially_paid")
  assert.equal(computeInvoiceStatus(inv({ status: "cancelled" }), now), "cancelled")
  const out = withInvoiceStatus(inv({ amountPaid: 3000 }), now)
  assert.equal(out.status, "partially_paid")
  assert.equal(out.balanceDue, 7000)
})

const full = {
  invoiceNumber: "INV-2026-000042",
  orderNumber: "1042",
  status: "unpaid",
  seller: { name: "ProVisuell AS", orgNumber: "123 456 789", address: "Stortelia 7", postalCode: "0250", city: "Oslo", email: "info@provisuell.no", website: "www.provisuell.no", vatRegistered: true },
  customer: { name: "Kari <script>Nordmann</script>", email: "kari@example.com", address: "Gate 1", postalCode: "0150", city: "Oslo", phone: "+47 900 00 000" },
  issueDate: "2026-09-20T10:00:00Z",
  dueDate: "2099-01-01T10:00:00Z",
  items: [
    { name: "Bilfoliering", description: "Full wrap", quantity: 1, unit: "stk", unitPrice: 8000, vatRate: 25, subtotal: 8000 },
    { name: "Design", quantity: 2, unit: "t", unitPrice: 500, vatRate: 25, subtotal: 1000 },
  ],
  subtotal: 9000,
  discount: 1000,
  vatAmount: 2250,
  grandTotal: 10250,
  amountPaid: 3000,
  payment: { bankAccount: "1234.56.78901", kid: "0042" },
  paymentTerms: "Betales innen forfallsdato.",
}

test("email: complete invoice with DUE tag and every required field", () => {
  const { html, text, subject, tag } = renderInvoiceEmail(full, { viewUrl: "https://provisuell.no/faktura/abc" })
  assert.equal(tag, "DUE")
  assert.match(subject, /INV-2026-000042/)
  for (const needle of [
    "ProVisuell", "INV-2026-000042", "#1042", "Kari", "kari@example.com", "+47 900 00 000", "Gate 1",
    "Bilfoliering", "Full wrap", "Design", "Delsum", "Rabatt", "MVA", "Totalt", "Betalt", "Beløp å betale",
    "Fakturadato", "Forfallsdato", "1234.56.78901", "KID", "0042", 'data-status="DUE"', ">UTESTÅENDE<", "https://provisuell.no/faktura/abc",
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`)
  }
  assert.match(html, /7[\s  ]250,00 kr/) // remaining = 10 250 − 3 000
  assert.match(html, /10[\s  ]250,00 kr/)
  assert.ok(!html.includes("<script>"), "customer data must be escaped")
  assert.match(text, /Beløp å betale: 7[\s  ]250,00 kr/)
})

test("email: tag follows the same rule for unpaid / paid / overdue", () => {
  assert.equal(renderInvoiceEmail({ ...full, amountPaid: 0 }).tag, "UNPAID")
  assert.equal(renderInvoiceEmail({ ...full, amountPaid: 10250 }).tag, "PAID")
  assert.equal(renderInvoiceEmail({ ...full, dueDate: "2020-01-01T00:00:00Z" }).tag, "OVERDUE")
})

test("email: status tag and labels follow the customer's language", () => {
  const expected = { no: "UTESTÅENDE", en: "DUE", sv: "UTESTÅENDE", da: "UDESTÅENDE", fi: "AVOIN", ro: "DE PLATĂ" }
  for (const [lang, label] of Object.entries(expected)) {
    const e = renderInvoiceEmail(full, { lang })
    assert.equal(e.tag, "DUE")
    assert.equal(e.tagLabel, label, lang)
    assert.ok(e.html.includes(`>${label}<`), lang)
  }
  const en = renderInvoiceEmail(full, { lang: "en" })
  for (const needle of ["Invoice date", "Due date", "Subtotal", "Amount due", "Paid", "Hi Kari"]) assert.ok(en.html.includes(needle), needle)
  // Customer-entered content is never translated.
  assert.ok(en.html.includes("Bilfoliering") && en.html.includes("Full wrap"))
  assert.equal(renderInvoiceEmail({ ...full, amountPaid: 0 }, { lang: "en" }).tagLabel, "UNPAID")
  assert.equal(renderInvoiceEmail({ ...full, amountPaid: 10250 }, { lang: "sv" }).tagLabel, "BETALD")
  // Unknown language → Norwegian.
  assert.equal(renderInvoiceEmail(full, { lang: "xx" }).lang, "no")
})
