"use client"

import { Fragment, useEffect, useState } from "react"
import { getLocale } from "@/lib/i18n/locale"
import { useRouter } from "next/navigation"
import { AlertTriangle, Bell, ChevronDown, ChevronUp, FileText } from "lucide-react"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import AddNoteButton from "@/components/notes/AddNoteButton"

function nok(value = 0) {
  return `kr ${Math.round(Number(value) || 0).toLocaleString("no-NO")},-`
}

function formatDate(value) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(getLocale(), { day: "2-digit", month: "2-digit", year: "numeric" })
}

export default function Kundebetalinger() {
  const { t, language } = useTranslation()
  const router = useRouter()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [expanded, setExpanded] = useState(null)
  const [reminding, setReminding] = useState(null)
  const [reminderSent, setReminderSent] = useState(null)
  const [statementByKey, setStatementByKey] = useState({})

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const { customers } = await api.get("/invoices/by-customer")
      setCustomers(customers)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const sendReminder = async (customer) => {
    const key = customer.customerId || customer.customerEmail
    setReminding(key)
    try {
      // Rolls every due invoice into one real statement invoice and sends
      // that (see Server/src/lib/invoicing.js createStatementInvoice) —
      // not just a text summary.
      const { statement } = await api.post("/invoices/remind", {
        lang: language,
        invoiceIds: customer.dueInvoices.map((i) => i._id),
        customerId: customer.customerId,
        customerEmail: customer.customerEmail,
        customerName: customer.customerName,
      })
      setReminderSent(key)
      setStatementByKey((prev) => ({ ...prev, [key]: statement }))
    } catch (err) {
      setError(err.message)
    } finally {
      setReminding(null)
    }
  }

  return (
    <div>
      <h1 className="text-[26px] font-[800] tracking-[-0.02em] text-white">{t("customerPaymentsPage.title")}</h1>
      <p className="mt-[4px] text-[14px] text-white/50">{t("customerPaymentsPage.subtitle")}</p>

      {error && <p className="mt-[16px] rounded-[8px] bg-red-500/10 px-[12px] py-[8px] text-[13px] text-red-300">{error}</p>}

      <div className="mt-[20px] overflow-x-auto rounded-[14px] border border-white/[0.08] bg-[#111212]">
        <table className="w-full min-w-[760px] text-left text-[13.5px]">
          <thead>
            <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-[0.04em] text-white/40">
              <th className="px-[18px] py-[13px] font-[600]">{t("customerPaymentsPage.tableCustomer")}</th>
              <th className="px-[18px] py-[13px] font-[600]">{t("common.total")}</th>
              <th className="px-[18px] py-[13px] font-[600]">{t("customerPaymentsPage.tablePaid")}</th>
              <th className="px-[18px] py-[13px] font-[600]">{t("customerPaymentsPage.tableUnpaid")}</th>
              <th className="px-[18px] py-[13px] font-[600]">{t("customerPaymentsPage.tableOutstanding")}</th>
              <th className="px-[18px] py-[13px] font-[600]"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-[18px] py-[20px] text-center text-white/40">
                  {t("customerPaymentsPage.loading")}
                </td>
              </tr>
            )}
            {!loading && customers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-[18px] py-[20px] text-center text-white/40">
                  {t("customerPaymentsPage.empty")}
                </td>
              </tr>
            )}
            {customers.map((c) => {
              const key = c.customerId || c.customerEmail
              const isExpanded = expanded === key
              const hasMultipleDue = c.dueCount > 1
              return (
                <Fragment key={key}>
                  <tr className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.015]">
                    <td className="px-[18px] py-[13px]">
                      <p className="flex items-center gap-[8px] font-[700] text-white">
                        {c.customerName}
                        <AddNoteButton type="customer" id={c.customerId || `email:${c.customerEmail}`} variant="icon" />
                      </p>
                      <p className="mt-[1px] text-[11.5px] text-white/40">{c.customerEmail || "—"}</p>
                    </td>
                    <td className="px-[18px] py-[13px] text-white/70">{c.totalInvoices}</td>
                    <td className="px-[18px] py-[13px]">
                      <span className="inline-flex items-center rounded-[5px] border border-emerald-500/40 bg-emerald-500/[0.08] px-[9px] py-[3px] text-[11px] font-[750] text-emerald-400">
                        {c.paidCount}
                      </span>
                    </td>
                    <td className="px-[18px] py-[13px]">
                      <span
                        className={`inline-flex items-center gap-[5px] rounded-[5px] border px-[9px] py-[3px] text-[11px] font-[750] ${
                          c.dueCount > 0
                            ? "border-[#ff5a00] bg-[#ff5a00]/[0.08] text-[#ff5a00]"
                            : "border-white/15 text-white/40"
                        }`}
                      >
                        {hasMultipleDue && <AlertTriangle size={11} />}
                        {c.dueCount}
                      </span>
                    </td>
                    <td className="px-[18px] py-[13px] font-[700] text-white">{c.dueCount > 0 ? nok(c.dueAmount) : "—"}</td>
                    <td className="px-[18px] py-[13px]">
                      <div className="flex items-center justify-end gap-[8px]">
                        {c.dueCount > 0 && (
                          <button
                            type="button"
                            onClick={() => sendReminder(c)}
                            disabled={reminding === key}
                            title={t("customerPaymentsPage.sendReminderTitle")}
                            className="flex h-[32px] items-center gap-[6px] rounded-[6px] border border-[#ff5a00] px-[10px] text-[11px] font-[700] text-[#ff5a00] transition-colors hover:bg-[#ff5a00]/10 disabled:opacity-50"
                          >
                            <Bell size={13} />
                            {reminding === key
                              ? t("customerPaymentsPage.sending")
                              : reminderSent === key
                                ? t("customerPaymentsPage.sent")
                                : t("customerPaymentsPage.remind")}
                          </button>
                        )}
                        {statementByKey[key] && (
                          <button
                            type="button"
                            onClick={() => router.push(`/faktura/${statementByKey[key]._id}`)}
                            title={t("customerPaymentsPage.viewStatementTitle")}
                            className="flex h-[32px] items-center gap-[6px] rounded-[6px] border border-emerald-500/50 px-[10px] text-[11px] font-[700] text-emerald-400 transition-colors hover:bg-emerald-500/10"
                          >
                            <FileText size={13} />
                            {t("customerPaymentsPage.statement")}
                          </button>
                        )}
                        {c.dueInvoices.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setExpanded(isExpanded ? null : key)}
                            className="flex h-[32px] w-[32px] items-center justify-center rounded-[6px] border border-white/15 text-white/60 hover:border-white/30 hover:text-white"
                          >
                            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-white/[0.06] bg-white/[0.012] last:border-0">
                      <td colSpan={6} className="px-[18px] py-[14px]">
                        <p className="mb-[8px] text-[11px] font-[700] uppercase tracking-[0.04em] text-white/40">
                          {t("customerPaymentsPage.unpaidInvoicesLabel")}
                        </p>
                        <div className="space-y-[6px]">
                          {c.dueInvoices.map((inv) => (
                            <button
                              key={inv._id}
                              type="button"
                              onClick={() => router.push(`/faktura/${inv._id}`)}
                              className="flex w-full items-center justify-between gap-[12px] rounded-[8px] border border-white/10 bg-white/[0.02] px-[12px] py-[9px] text-left transition-colors hover:border-[#ff5a00]/40"
                            >
                              <span className="flex items-center gap-[8px] text-[12.5px] text-white/80">
                                <FileText size={13} className="text-white/40" />
                                {inv.invoiceNumber} <span className="text-white/35">— #{inv.orderNumber}</span>
                              </span>
                              <span className="flex items-center gap-[14px] text-[12px] text-white/50">
                                <span>{t("customerPaymentsPage.dueOn", { date: formatDate(inv.dueDate) })}</span>
                                <span className="font-[700] text-white">{nok(inv.amount)}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}