"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"

function todayPlusDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function CreateInvoiceModal({ order, onClose, onCreated }) {
  const { t } = useTranslation()
  const [dueDate, setDueDate] = useState(todayPlusDays(14))
  const [deliveryDate, setDeliveryDate] = useState(
    order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toISOString().slice(0, 10) : ""
  )
  const [deliveryPlace, setDeliveryPlace] = useState("")
  const [discount, setDiscount] = useState("")
  const [paymentTerms, setPaymentTerms] = useState(() => t("createInvoiceModal.defaultPaymentTerms"))
  const [bankAccount, setBankAccount] = useState("")
  const [kid, setKid] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    if (!dueDate) {
      setError(t("createInvoiceModal.dueDateRequiredError"))
      return
    }
    setSaving(true)
    try {
      const { invoice } = await api.post("/invoices", {
        orderId: order._id,
        dueDate,
        deliveryDate: deliveryDate || null,
        deliveryPlace: deliveryPlace.trim(),
        discount: discount ? Number(discount) : 0,
        paymentTerms: paymentTerms.trim(),
        note: note.trim(),
        payment: { bankAccount: bankAccount.trim(), kid: kid.trim() },
      })
      onCreated(invoice)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-[16px]" onClick={onClose}>
      <div
        className="w-full max-w-[460px] max-h-[90vh] overflow-y-auto rounded-[16px] border border-white/10 bg-[#111212] p-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-[6px] flex items-center justify-between">
          <h2 className="text-[18px] font-[800] text-white">{t("createInvoiceModal.title")}</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <p className="mb-[16px] text-[13px] text-white/50">
          {t("createInvoiceModal.forOrder", { orderNumber: order.orderNumber, customerName: order.customerName })}
        </p>

        {error && <p className="mb-[14px] rounded-[8px] bg-red-500/10 px-[12px] py-[8px] text-[13px] text-red-300">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-[14px]">
          <div className="flex gap-[12px]">
            <div className="flex-1">
              <label className="mb-[6px] block text-[12px] font-[600] text-white/70">{t("createInvoiceModal.dueDateLabel")}</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[12px] py-[9px] text-[13px] text-white outline-none focus:border-[#ff4b00]"
              />
            </div>
            <div className="flex-1">
              <label className="mb-[6px] block text-[12px] font-[600] text-white/70">{t("createInvoiceModal.deliveryDateLabel")}</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[12px] py-[9px] text-[13px] text-white outline-none focus:border-[#ff4b00]"
              />
            </div>
          </div>

          <div>
            <label className="mb-[6px] block text-[12px] font-[600] text-white/70">{t("createInvoiceModal.deliveryPlaceLabel")}</label>
            <input
              value={deliveryPlace}
              onChange={(e) => setDeliveryPlace(e.target.value)}
              placeholder={t("createInvoiceModal.deliveryPlacePlaceholder")}
              className="w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[12px] py-[9px] text-[13px] text-white outline-none focus:border-[#ff4b00]"
            />
          </div>

          <div>
            <label className="mb-[6px] block text-[12px] font-[600] text-white/70">{t("createInvoiceModal.discountLabel")}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder={t("createInvoiceModal.discountPlaceholder")}
              className="w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[12px] py-[9px] text-[13px] text-white outline-none focus:border-[#ff4b00]"
            />
          </div>

          <div className="flex gap-[12px]">
            <div className="flex-1">
              <label className="mb-[6px] block text-[12px] font-[600] text-white/70">{t("createInvoiceModal.bankAccountLabel")}</label>
              <input
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder={t("createInvoiceModal.bankAccountPlaceholder")}
                className="w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[12px] py-[9px] text-[13px] text-white outline-none focus:border-[#ff4b00]"
              />
            </div>
            <div className="flex-1">
              <label className="mb-[6px] block text-[12px] font-[600] text-white/70">{t("createInvoiceModal.kidLabel")}</label>
              <input
                value={kid}
                onChange={(e) => setKid(e.target.value)}
                className="w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[12px] py-[9px] text-[13px] text-white outline-none focus:border-[#ff4b00]"
              />
            </div>
          </div>

          <div>
            <label className="mb-[6px] block text-[12px] font-[600] text-white/70">{t("createInvoiceModal.paymentTermsLabel")}</label>
            <input
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[12px] py-[9px] text-[13px] text-white outline-none focus:border-[#ff4b00]"
            />
          </div>

          <div>
            <label className="mb-[6px] block text-[12px] font-[600] text-white/70">{t("createInvoiceModal.noteLabel")}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-[8px] border border-white/15 bg-white/[0.04] px-[12px] py-[9px] text-[13px] text-white outline-none focus:border-[#ff4b00]"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-[8px] bg-[#ff4b00] py-[11px] text-[13px] font-[800] uppercase tracking-[0.02em] text-white hover:brightness-110 disabled:opacity-50"
          >
            {saving ? t("createInvoiceModal.creating") : t("createInvoiceModal.title")}
          </button>
        </form>
      </div>
    </div>
  )
}