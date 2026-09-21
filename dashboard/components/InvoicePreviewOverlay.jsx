"use client"

import { Check, X } from "lucide-react"
import Invoice from "../pages/Invoice"
import { useTranslation } from "@/lib/i18n"

// Builds an Invoice-shaped object straight from the order's own itemized
// lines — no backend call, no invoice number issued. Purely a decision-
// support preview so the owner can see what this order would actually bill
// out to before approving or rejecting it.
function buildPreviewInvoice(order, t) {
  const items = order.items?.length
    ? order.items.map((i) => ({ ...i, subtotal: i.quantity * i.unitPrice }))
    : [
        {
          name: order.service,
          description: order.specification || "",
          quantity: 1,
          unit: t("invoicePreviewOverlay.unitPiece"),
          unitPrice: order.amount || 0,
          vatRate: 25,
          subtotal: order.amount || 0,
        },
      ]

  return {
    invoiceNumber: t("invoicePreviewOverlay.previewNumber"),
    orderNumber: order.orderNumber,
    status: "draft",
    customer: { name: order.customerName, email: order.customerEmail },
    issueDate: new Date(),
    deliveryDate: order.expectedDeliveryDate || null,
    items,
    subtotal: order.subtotal || items.reduce((sum, i) => sum + i.subtotal, 0),
    discount: order.discount || 0,
    vatAmount: order.vatAmount || 0,
    grandTotal: order.grandTotal || order.amount || 0,
    note: t("invoicePreviewOverlay.previewNote"),
  }
}

export default function InvoicePreviewOverlay({ order, onClose, onDecide, busy }) {
  const { t } = useTranslation()
  const preview = buildPreviewInvoice(order, t)

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#ededed]">
      <div className="mx-auto flex w-full max-w-[980px] flex-wrap items-center justify-between gap-[10px] px-[16px] pt-[24px] print:hidden">
        <p className="text-[12.5px] text-[#666]">{t("invoicePreviewOverlay.previewBanner")}</p>
        <div className="flex items-center gap-[10px]">
          <button
            type="button"
            onClick={() => onDecide(order._id, "approved")}
            disabled={busy}
            className="flex h-[38px] items-center gap-[7px] rounded-[6px] border border-[#299545] bg-white px-[14px] text-[12px] font-[700] text-[#299545] transition-colors hover:bg-[#edf9f0] disabled:opacity-50"
          >
            <Check size={15} />
            {t("common.approve")}
          </button>
          <button
            type="button"
            onClick={() => onDecide(order._id, "rejected")}
            disabled={busy}
            className="flex h-[38px] items-center gap-[7px] rounded-[6px] border border-[#d83229] bg-white px-[14px] text-[12px] font-[700] text-[#d83229] transition-colors hover:bg-[#fff0ef] disabled:opacity-50"
          >
            <X size={15} />
            {t("common.reject")}
          </button>
        </div>
      </div>
      <Invoice invoice={preview} onBack={onClose} />
    </div>
  )
}