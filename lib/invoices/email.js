import { STATUS_TAG, computeInvoiceStatus, invoiceAmounts } from "./status.js"
import { DATE_LOCALES, pickLanguage, translator } from "../i18n/server.js"

// The full ProVisuell invoice as an email: same data and the same status
// rule (lib/invoices/status.js) as the invoice page and its PDF download,
// and the same NO / EN / SV / FI / DA labels (lib/i18n/locales). Only the
// customer-entered content (names, line descriptions, notes) is left as is.
// Table-based with inline styles only — email clients ignore <style> sheets.

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])

// Amounts stay in NOK with Norwegian number formatting on every language —
// the same as the invoice document itself.
const nok = (v) => `${Number(v || 0).toLocaleString("no-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`

// Style per status (the machine tag); the visible text is translated.
const TAG_STYLE = {
  UNPAID: "color:#ff4b00;border-color:#ff4b00;background:#fff3ed",
  DUE: "color:#a86d00;border-color:#e79b00;background:#fff8e6",
  OVERDUE: "color:#d83229;border-color:#d83229;background:#fff0ef",
  PAID: "color:#299545;border-color:#299545;background:#edf9f0",
  CANCELLED: "color:#666;border-color:#777;background:#f2f2f2",
  DRAFT: "color:#666;border-color:#999;background:#f4f4f4",
}

const STATUS_LABEL_KEY = {
  unpaid: "status.unpaid",
  issued: "status.unpaid",
  partially_paid: "invoicePage.statusPartiallyPaid",
  overdue: "invoicePage.statusOverdue",
  paid: "status.paid",
  cancelled: "status.cancelled",
  draft: "status.draft",
}

function lines(...parts) {
  return parts.filter(Boolean).map(esc).join("<br>")
}

function row(label, value, { strong = false, color = "#151515" } = {}) {
  return `<tr><td style="padding:5px 0;font-size:13px;color:#666">${esc(label)}</td><td style="padding:5px 0;font-size:13px;text-align:right;color:${color};${strong ? "font-weight:800" : ""}">${value}</td></tr>`
}

// `lang`: the customer's saved language (falls back to Norwegian).
// `intro`: optional ready-made HTML paragraph replacing the default one.
export function renderInvoiceEmail(invoice, { viewUrl = "", intro = "", lang } = {}) {
  const language = pickLanguage(lang)
  const t = translator(language)
  const date = (v) =>
    v ? new Date(v).toLocaleDateString(DATE_LOCALES[language], { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Oslo" }) : "—"

  const status = computeInvoiceStatus(invoice)
  const tag = STATUS_TAG[status] || "UNPAID"
  const tagLabel = t(STATUS_LABEL_KEY[status] || "status.unpaid")
  const { total, paid, balance } = invoiceAmounts(invoice)
  const seller = invoice.seller || {}
  const customer = invoice.customer || {}
  const pay = invoice.payment || {}
  const items = invoice.items || []
  const subtotal = Number(invoice.subtotal ?? items.reduce((s, i) => s + Number(i.subtotal ?? i.quantity * i.unitPrice), 0))
  const discount = Number(invoice.discount || 0)
  const vat = Number(invoice.vatAmount || 0)
  const number = invoice.invoiceNumber
  const label = (k) => esc(t(`invoicePage.${k}`)).toUpperCase()

  const itemRows = items
    .map((i) => {
      const lineTotal = Number(i.subtotal ?? Number(i.quantity) * Number(i.unitPrice))
      return `<tr>
  <td style="padding:12px 10px;border-bottom:1px solid #eee;vertical-align:top">
    <div style="font-size:13px;font-weight:700;color:#151515">${esc(i.name)}</div>
    ${i.description ? `<div style="margin-top:4px;font-size:11.5px;color:#777;line-height:1.5">${esc(i.description)}</div>` : ""}
  </td>
  <td style="padding:12px 8px;border-bottom:1px solid #eee;text-align:right;font-size:12.5px;color:#555;white-space:nowrap">${esc(i.quantity)} ${esc(i.unit || t("invoicePage.pcs"))}</td>
  <td style="padding:12px 8px;border-bottom:1px solid #eee;text-align:right;font-size:12.5px;color:#555;white-space:nowrap">${nok(i.unitPrice)}</td>
  <td style="padding:12px 8px;border-bottom:1px solid #eee;text-align:right;font-size:12.5px;color:#555">${esc(i.vatRate ?? 25)} %</td>
  <td style="padding:12px 10px;border-bottom:1px solid #eee;text-align:right;font-size:12.5px;font-weight:700;color:#151515;white-space:nowrap">${nok(lineTotal)}</td>
</tr>`
    })
    .join("")

  const paymentInfo = [
    pay.bankAccount && row(t("invoicePage.accountNumber"), esc(pay.bankAccount)),
    pay.kid && row(t("invoicePage.kid"), esc(pay.kid)),
    pay.iban && row(t("invoicePage.iban"), esc(pay.iban)),
    pay.swift && row(t("invoicePage.swiftBic"), esc(pay.swift)),
    row(t("invoicePage.reference"), esc(pay.paymentReference || number)),
    row(t("invoicePage.dueDate"), esc(date(invoice.dueDate)), { strong: true }),
  ]
    .filter(Boolean)
    .join("")

  const greeting = customer.name ? esc(t("invoiceEmail.greeting", { name: customer.name })) : esc(t("invoiceEmail.greetingNoName"))
  const defaultIntro =
    tag === "PAID"
      ? esc(t("invoiceEmail.introPaid", { number }))
      : esc(t("invoiceEmail.introDue", { number, amount: nok(balance), date: date(invoice.dueDate) }))

  const html = `<!doctype html>
<html lang="${language === "no" ? "nb" : language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(t("invoicePage.title"))} ${esc(number)}</title></head>
<body style="margin:0;padding:0;background:#ededed;font-family:Arial,Helvetica,sans-serif;color:#151515">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ededed;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px">
  <tr><td style="padding:0 4px 14px;font-size:14px;line-height:1.6;color:#333">${greeting}<br>${intro || defaultIntro}</td></tr>
  <tr><td style="background:#ffffff;border-radius:10px;overflow:hidden">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="background:#0a0a0a;padding:22px 26px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#ffffff">Pro<span style="color:#ff4b00">Visuell</span>
            <div style="margin-top:4px;font-size:10px;font-weight:700;letter-spacing:0.14em;color:#8a8a8a">${esc(t("invoicePage.tagline"))}</div></td>
          <td style="text-align:right;color:#ffffff">
            <div style="font-size:11px;letter-spacing:0.12em;color:#8a8a8a">${esc(t("invoicePage.title"))}</div>
            <div style="font-size:17px;font-weight:800">${esc(number)}</div>
            <div style="margin-top:8px"><span data-status="${tag}" style="display:inline-block;border:1px solid;border-radius:4px;padding:4px 10px;font-size:10px;font-weight:800;letter-spacing:0.08em;${TAG_STYLE[tag]}">${esc(tagLabel)}</span></div>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:22px 26px 6px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="top" width="50%" style="padding-right:12px;font-size:12.5px;line-height:1.6;color:#444">
            <div style="font-size:10px;font-weight:800;letter-spacing:0.1em;color:#999;margin-bottom:6px">${label("from")}</div>
            <strong style="color:#151515">${esc(seller.name || "ProVisuell AS")}</strong><br>
            ${lines(seller.orgNumber && `${t("invoicePage.orgNumber")} ${seller.orgNumber}${seller.vatRegistered !== false ? " MVA" : ""}`, seller.address, [seller.postalCode, seller.city].filter(Boolean).join(" "), seller.country, seller.email, seller.website)}
          </td>
          <td valign="top" width="50%" style="padding-left:12px;font-size:12.5px;line-height:1.6;color:#444">
            <div style="font-size:10px;font-weight:800;letter-spacing:0.1em;color:#999;margin-bottom:6px">${label("billedTo")}</div>
            <strong style="color:#151515">${esc(customer.name || "—")}</strong><br>
            ${lines(customer.orgNumber && `${t("invoicePage.orgNumber")} ${customer.orgNumber}`, customer.address, [customer.postalCode, customer.city].filter(Boolean).join(" "), customer.email, customer.phone)}
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:14px 26px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;border-radius:8px"><tr>
          <td style="padding:12px 14px;font-size:11px;color:#777">${esc(t("invoicePage.invoiceDate"))}<br><strong style="font-size:13px;color:#151515">${esc(date(invoice.issueDate))}</strong></td>
          <td style="padding:12px 14px;font-size:11px;color:#777">${esc(t("invoicePage.dueDate"))}<br><strong style="font-size:13px;color:#151515">${esc(date(invoice.dueDate))}</strong></td>
          <td style="padding:12px 14px;font-size:11px;color:#777">${esc(t("invoicePage.orderNumber"))}<br><strong style="font-size:13px;color:#151515">${esc(invoice.orderNumber ? `#${invoice.orderNumber}` : "—")}</strong></td>
          ${invoice.deliveryDate ? `<td style="padding:12px 14px;font-size:11px;color:#777">${esc(t("invoicePage.deliveryDate"))}<br><strong style="font-size:13px;color:#151515">${esc(date(invoice.deliveryDate))}</strong></td>` : ""}
        </tr></table>
      </td></tr>
      <tr><td style="padding:4px 26px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px">
          <tr style="background:#fafafa">
            <th align="left" style="padding:10px;font-size:10.5px;letter-spacing:0.06em;color:#888">${label("productService")}</th>
            <th align="right" style="padding:10px 8px;font-size:10.5px;letter-spacing:0.06em;color:#888">${label("qty")}</th>
            <th align="right" style="padding:10px 8px;font-size:10.5px;letter-spacing:0.06em;color:#888">${label("priceExVat")}</th>
            <th align="right" style="padding:10px 8px;font-size:10.5px;letter-spacing:0.06em;color:#888">${label("vat")}</th>
            <th align="right" style="padding:10px;font-size:10.5px;letter-spacing:0.06em;color:#888">${label("sum")}</th>
          </tr>
          ${itemRows || `<tr><td colspan="5" style="padding:14px;font-size:12.5px;color:#888">${esc(t("invoicePage.noLineItems"))}</td></tr>`}
        </table>
      </td></tr>
      <tr><td style="padding:16px 26px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
          <td valign="top" width="52%" style="padding-right:16px">
            <div style="font-size:10px;font-weight:800;letter-spacing:0.1em;color:#999;margin-bottom:4px">${label("paymentInfo")}</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${paymentInfo}</table>
            ${invoice.paymentTerms ? `<p style="margin:10px 0 0;font-size:11.5px;color:#777">${esc(invoice.paymentTerms)}</p>` : ""}
          </td>
          <td valign="top" width="48%">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${row(t("invoicePage.subtotal"), nok(subtotal))}
              ${discount > 0 ? row(t("invoicePage.discount"), `- ${nok(discount)}`) : ""}
              ${row(t("invoicePage.vat"), nok(vat))}
              <tr><td colspan="2" style="border-top:1px solid #e5e5e5;padding-top:4px"></td></tr>
              ${row(t("invoicePage.total"), nok(total), { strong: true })}
              ${row(t("invoicePage.paidLabel"), paid > 0 ? `- ${nok(paid)}` : nok(0), { color: paid > 0 ? "#299545" : "#151515" })}
              <tr><td style="padding:10px 0 0;font-size:14px;font-weight:800;color:#151515">${esc(t("invoicePage.amountDue"))}</td>
                  <td data-balance style="padding:10px 0 0;font-size:18px;font-weight:800;text-align:right;color:${balance > 0 ? "#ff4b00" : "#299545"}">${nok(balance)}</td></tr>
            </table>
          </td>
        </tr></table>
      </td></tr>
      ${invoice.note ? `<tr><td style="padding:0 26px 16px;font-size:12px;color:#666;line-height:1.6"><strong>${esc(t("invoicePage.note"))}:</strong> ${esc(invoice.note)}</td></tr>` : ""}
      ${viewUrl ? `<tr><td style="padding:0 26px 24px"><a href="${esc(viewUrl)}" style="display:inline-block;background:#ff4b00;color:#ffffff;text-decoration:none;font-weight:800;font-size:13px;padding:12px 20px;border-radius:8px">${esc(t("invoiceEmail.viewButton"))}</a></td></tr>` : ""}
    </table>
  </td></tr>
  <tr><td style="padding:14px 4px;font-size:11px;line-height:1.6;color:#888;text-align:center">${esc(seller.name || "ProVisuell AS")} · ${esc(seller.email || "info@provisuell.no")}${seller.website ? ` · ${esc(seller.website)}` : ""}</td></tr>
</table>
</td></tr></table>
</body></html>`

  const text = [
    customer.name ? t("invoiceEmail.greeting", { name: customer.name }) : t("invoiceEmail.greetingNoName"),
    "",
    `${t("invoicePage.title")} ${number} — ${tagLabel}`,
    invoice.orderNumber ? `${t("invoicePage.orderNumber")}: #${invoice.orderNumber}` : "",
    `${t("invoicePage.invoiceDate")}: ${date(invoice.issueDate)}   ${t("invoicePage.dueDate")}: ${date(invoice.dueDate)}`,
    "",
    ...items.map((i) => `- ${i.name}: ${i.quantity} ${i.unit || t("invoicePage.pcs")} x ${nok(i.unitPrice)} (${t("invoicePage.vat")} ${i.vatRate ?? 25} %) = ${nok(i.subtotal ?? i.quantity * i.unitPrice)}`),
    "",
    `${t("invoicePage.subtotal")}: ${nok(subtotal)}`,
    discount > 0 ? `${t("invoicePage.discount")}: -${nok(discount)}` : "",
    `${t("invoicePage.vat")}: ${nok(vat)}`,
    `${t("invoicePage.total")}: ${nok(total)}`,
    `${t("invoicePage.paidLabel")}: ${nok(paid)}`,
    `${t("invoicePage.amountDue")}: ${nok(balance)}`,
    "",
    pay.bankAccount ? `${t("invoicePage.accountNumber")}: ${pay.bankAccount}` : "",
    pay.kid ? `${t("invoicePage.kid")}: ${pay.kid}` : "",
    `${t("invoicePage.reference")}: ${pay.paymentReference || number}`,
    viewUrl ? `\n${t("invoiceEmail.viewButton")}: ${viewUrl}` : "",
    "",
    t("invoiceEmail.closing"),
  ]
    .filter((l) => l !== "")
    .join("\n")

  const subjectKey = { PAID: "invoiceEmail.subjectPaid", DUE: "invoiceEmail.subjectDue", OVERDUE: "invoiceEmail.subjectOverdue" }[tag] || "invoiceEmail.subject"
  const subject = t(subjectKey, { number, amount: nok(balance) })

  return { subject, html, text, status, tag, tagLabel, lang: language }
}
