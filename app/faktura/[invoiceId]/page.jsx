"use client"

import { useEffect, useState } from "react"
import { getLocale } from "@/lib/i18n/locale"
import { useParams, useRouter } from "next/navigation"
import { CheckCircle2, Send } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import ProtectedRoute from "@/context/ProtectedRoute"
import { api } from "@/lib/api"
import Invoice from "@/dashboard/pages/Invoice"
import { useTranslation } from "@/lib/i18n"

// Shared by all three audiences (owner, administrator, customer) — the
// backend enforces who may actually see a given invoice, so this page just
// decides whether to also show the management toolbar.
function FakturaVisning() {
  const { t } = useTranslation()
  const { invoiceId } = useParams()
  const router = useRouter()
  const { role } = useAuth()
  const canManage = role === "owner" || role === "administrator"

  const [invoice, setInvoice] = useState(null)
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)
  const [updatingPayment, setUpdatingPayment] = useState(false)

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
      const { invoice: updated } = await api.post(`/invoices/${invoiceId}/send`)
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
      const { invoice: updated } = await api.patch(`/invoices/${invoiceId}/payment`, {
        status: "paid",
        amountPaid: invoice.grandTotal,
      })
      setInvoice(updated)
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
              {invoice.status !== "paid" && invoice.status !== "cancelled" && (
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
              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className="flex h-[38px] items-center gap-[7px] rounded-[6px] bg-[#171717] px-[14px] text-[12px] font-[700] text-white transition-colors hover:bg-[#2b2b2b] disabled:opacity-50"
              >
                <Send size={15} />
                {sending ? t("invoiceView.sending") : invoice.sentAt ? t("invoiceView.resend") : t("invoiceView.sendInvoice")}
              </button>
            </div>
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
