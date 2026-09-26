"use client"

import { useEffect, useState } from "react"
import { getLocale } from "@/lib/i18n/locale"
import { useParams, useRouter } from "next/navigation"
import { CheckCircle2, Send } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import ProtectedRoute from "@/context/ProtectedRoute"
import { api } from "@/lib/api"
import Invoice from "@/dashboard/pages/Invoice"
import AddNoteButton from "@/components/notes/AddNoteButton"
import { useNotes } from "@/context/NotesContext"
import { useTranslation } from "@/lib/i18n"

// Shared by all three audiences (owner, administrator, customer) — the
// backend enforces who may actually see a given invoice, so this page just
// decides whether to also show the management toolbar.
function FakturaVisning() {
  const { t, language } = useTranslation()
  const { invoiceId } = useParams()
  const router = useRouter()
  const { can } = useAuth()
  const canManage = can("invoices.send") || can("invoices.recordPayment")
  const { enabled: notesEnabled } = useNotes()

  const [invoice, setInvoice] = useState(null)
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)
  const [updatingPayment, setUpdatingPayment] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")

  useEffect(() => {
    let cancelled = false
    api
      .get(`/invoices/${invoiceId}`)
      .then((data) => !cancelled && setInvoice(data.invoice))
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [invoiceId])

  const handleSend = async () => {
    setSending(true)
    setError("")
    try {
      const { invoice: updated } = await api.post(`/invoices/${invoiceId}/send`, { lang: language })
      setInvoice(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const markPaid = async () => {
    setUpdatingPayment(true)
    setError("")
    try {
      const { invoice: updated } = await api.patch(`/invoices/${invoiceId}/payment`, { status: "paid" })
      setInvoice(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdatingPayment(false)
    }
  }

  // A part payment: the server adds it and derives DUE / PAID itself.
  const addPayment = async (e) => {
    e.preventDefault()
    const amount = Number(String(paymentAmount).replace(",", "."))
    if (!(amount > 0)) return
    setUpdatingPayment(true)
    setError("")
    try {
      const { invoice: updated } = await api.patch(`/invoices/${invoiceId}/payment`, { addPayment: amount })
      setInvoice(updated)
      setPaymentAmount("")
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdatingPayment(false)
    }
  }

  if (error && !invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-[20px] text-center text-white">
        <p className="text-[14px] text-white/60">{error}</p>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-[#ff4b00]" />
      </div>
    )
  }

  return (
    <div>
      {canManage && (
        <div className="bg-[#ededed] px-[16px] pt-[24px] print:hidden">
          <div className="mx-auto flex w-full max-w-[980px] flex-wrap items-center justify-between gap-[10px]">
            <p className="text-[12.5px] text-[#666]">
              {invoice.sentAt
                ? t("invoiceView.sentToCustomer", { date: new Date(invoice.sentAt).toLocaleString(getLocale(), { dateStyle: "medium", timeStyle: "short" }) })
                : t("invoiceView.notSentYet")}
              {error && <span className="ml-[10px] text-[#d83229]">{error}</span>}
            </p>
            <div className="flex items-center gap-[10px]">
              {can("invoices.recordPayment") && invoice.status !== "paid" && invoice.status !== "cancelled" && (
                <form onSubmit={addPayment} className="flex h-[38px] items-center overflow-hidden rounded-[6px] border border-[#ccc] bg-white">
                  <label htmlFor="add-payment" className="sr-only">{t("invoiceView.paymentAmount")}</label>
                  <input
                    id="add-payment"
                    inputMode="decimal"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder={t("invoiceView.paymentAmount")}
                    className="h-full w-[120px] px-[10px] text-[12px] text-[#151515] outline-none"
                  />
                  <button type="submit" disabled={updatingPayment || !paymentAmount} className="h-full border-l border-[#ccc] px-[12px] text-[12px] font-[700] text-[#151515] hover:bg-[#f4f4f4] disabled:opacity-50">
                    {t("invoiceView.registerPayment")}
                  </button>
                </form>
              )}
              {can("invoices.recordPayment") && invoice.status !== "paid" && invoice.status !== "cancelled" && (
                <button
                  type="button"
                  onClick={markPaid}
                  disabled={updatingPayment}
                  className="flex h-[38px] items-center gap-[7px] rounded-[6px] border border-[#299545] bg-white px-[14px] text-[12px] font-[700] text-[#299545] transition-colors hover:bg-[#edf9f0] disabled:opacity-50"
                >
                  <CheckCircle2 size={15} />
                  {updatingPayment ? t("invoiceView.updating") : t("invoiceView.markPaid")}
                </button>
              )}
              {can("invoices.send") && (
              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className="flex h-[38px] items-center gap-[7px] rounded-[6px] bg-[#171717] px-[14px] text-[12px] font-[700] text-white transition-colors hover:bg-[#2b2b2b] disabled:opacity-50"
              >
                <Send size={15} />
                {sending ? t("invoiceView.sending") : invoice.sentAt ? t("invoiceView.resend") : t("invoiceView.sendInvoice")}
              </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Staff with Notes access only — never shown to customers. */}
      {notesEnabled && (
      <div className="bg-[#ededed] px-[16px] pt-[12px] print:hidden">
        <div className="mx-auto flex w-full max-w-[980px] justify-end [&_button]:!border-[#bbb] [&_button]:!bg-white [&_button]:!text-[#222] [&_a]:!text-[#555]">
          <AddNoteButton type="invoice" id={invoice._id} />
        </div>
      </div>
      )}
      <Invoice invoice={invoice} onBack={() => router.back()} />
    </div>
  )
}

export default function FakturaVisningPage() {
  return (
    <ProtectedRoute>
      <FakturaVisning />
    </ProtectedRoute>
  )
}
