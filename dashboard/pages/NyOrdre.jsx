"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { getLocale } from "@/lib/i18n/locale"
import { useRouter } from "next/navigation"
import { CalendarClock, CloudUpload, File, Plus, Search, UserCheck, X } from "lucide-react"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { useAuth } from "@/context/AuthContext"

const SERVICES = ["Brandify", "Packaging", "Vehicle Protection", "Window Tint", "PPF"]
const VAT_RATES = [25, 15, 12, 0]
const EMPTY_ITEM = { name: "", description: "", quantity: 1, unit: "stk", unitPrice: "", vatRate: 25 }

function nok(value = 0) {
  return `kr ${Math.round(Number(value) || 0).toLocaleString("no-NO")},-`
}

function formatApptOption(a, t) {
  const when = new Date(a.start).toLocaleString(getLocale(), { dateStyle: "medium", timeStyle: "short" })
  return a.status === "completed" ? `${a.title} — ${when} ${t("newOrderPage.completedSuffix")}` : `${a.title} — ${when}`
}

export default function NyOrdre() {
  const { t } = useTranslation()
  const router = useRouter()
  const { role } = useAuth()
  const base = role === "owner" ? "/dashboard/owner" : "/dashboard/admin"
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [service, setService] = useState("")
  const [specification, setSpecification] = useState("")
  const [items, setItems] = useState([{ ...EMPTY_ITEM }])
  const [discount, setDiscount] = useState("")
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("")
  const [internalNote, setInternalNote] = useState("")
  const [files, setFiles] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [savedOrder, setSavedOrder] = useState(null)

  // If this order came out of a booked meeting, the admin can link it here
  // so approving/rejecting it also resolves that appointment automatically.
  const [matchingAppointments, setMatchingAppointments] = useState([])
  const [appointmentId, setAppointmentId] = useState("")

  useEffect(() => {
    const email = customerEmail.trim()
    if (!email || !email.includes("@")) {
      setMatchingAppointments([])
      setAppointmentId("")
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const { appointments } = await api.get(`/appointments?customerEmail=${encodeURIComponent(email)}`)
        if (!cancelled) setMatchingAppointments(appointments.filter((a) => a.status !== "cancelled"))
      } catch (err) {
        if (!cancelled) setMatchingAppointments([])
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [customerEmail])

  // Search registered customer accounts as the admin types the name, so the
  // order links to the exact email that customer signed up with instead of
  // a hand-typed guess.
  const [customerSuggestions, setCustomerSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [matchedAccount, setMatchedAccount] = useState(null)
  const suggestionBoxRef = useRef(null)

  useEffect(() => {
    const term = customerName.trim()
    if (matchedAccount || term.length < 2) {
      setCustomerSuggestions([])
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const { customers } = await api.get(`/users/customers?search=${encodeURIComponent(term)}`)
        if (!cancelled) setCustomerSuggestions(customers)
      } catch (err) {
        if (!cancelled) setCustomerSuggestions([])
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [customerName, matchedAccount])

  useEffect(() => {
    const onClickOutside = (e) => {
      if (suggestionBoxRef.current && !suggestionBoxRef.current.contains(e.target)) setShowSuggestions(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  const selectCustomerAccount = (customer) => {
    setCustomerName(customer.name || customer.email)
    setCustomerEmail(customer.email)
    setMatchedAccount(customer)
    setShowSuggestions(false)
    setCustomerSuggestions([])
  }

  const addFiles = (fileList) => {
    setFiles((prev) => [...prev, ...Array.from(fileList)])
  }

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const updateItem = (index, field, value) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }])

  const removeItem = (index) => setItems((prev) => prev.filter((_, i) => i !== index))

  const validItems = items.filter((i) => i.name.trim())

  const totals = useMemo(() => {
    const subtotal = validItems.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0)
    const vatAmount = validItems.reduce(
      (sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0) * (Number(i.vatRate) || 0) / 100,
      0
    )
    const discountAmount = Math.max(0, Number(discount) || 0)
    const grandTotal = Math.max(0, subtotal - discountAmount) + vatAmount
    return { subtotal, vatAmount, discountAmount, grandTotal }
  }, [validItems, discount])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    if (!customerName.trim() || !customerEmail.trim() || !service || !specification.trim()) {
      setError(t("newOrderPage.errorRequired"))
      return
    }
    if (!customerEmail.includes("@")) {
      setError(t("newOrderPage.errorInvalidEmail"))
      return
    }

    setSaving(true)
    try {
      let attachments = []
      if (files.length > 0) {
        const formData = new FormData()
        files.forEach((f) => formData.append("files", f))
        const { files: uploaded } = await api.postForm("/uploads", formData)
        attachments = uploaded
      }

      const { order } = await api.post("/orders", {
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        service,
        specification: specification.trim(),
        items: validItems.map((i) => ({
          name: i.name.trim(),
          description: i.description.trim(),
          quantity: Number(i.quantity) || 0,
          unit: i.unit.trim() || "stk",
          unitPrice: Number(i.unitPrice) || 0,
          vatRate: Number(i.vatRate) || 0,
        })),
        discount: totals.discountAmount,
        expectedDeliveryDate: expectedDeliveryDate || null,
        internalNote: internalNote.trim(),
        attachments,
        appointmentId: appointmentId || null,
      })
      setSavedOrder(order)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (savedOrder) {
    return (
      <div className="mx-auto max-w-[520px] rounded-[16px] border border-emerald-500/25 bg-emerald-500/[0.06] p-[28px] text-center">
        <p className="text-[13px] font-[700] uppercase tracking-[0.03em] text-emerald-400">{t("newOrderPage.orderRegistered")}</p>
        <h1 className="mt-[8px] text-[24px] font-[800] text-white">{savedOrder.orderNumber}</h1>
        <p className="mt-[8px] text-[14px] text-white/60">
          {t("newOrderPage.orderRegisteredDesc")}
        </p>
        <div className="mt-[20px] flex justify-center gap-[10px]">
          <button
            onClick={() => {
              setSavedOrder(null)
              setCustomerName("")
              setCustomerEmail("")
              setService("")
              setSpecification("")
              setItems([{ ...EMPTY_ITEM }])
              setDiscount("")
              setExpectedDeliveryDate("")
              setInternalNote("")
              setFiles([])
              setAppointmentId("")
              setMatchedAccount(null)
              setCustomerSuggestions([])
            }}
            className="rounded-[10px] border border-white/15 px-[18px] py-[10px] text-[13px] font-[700] text-white hover:bg-white/[0.06]"
          >
            {t("newOrderPage.registerNewOrder")}
          </button>
          <button
            onClick={() => router.push(`${base}/ordreoversikt`)}
            className="rounded-[10px] bg-[#ff4b00] px-[18px] py-[10px] text-[13px] font-[800] uppercase tracking-[0.02em] text-white hover:brightness-110"
          >
            {t("newOrderPage.viewOrders")}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-[26px] font-[800] tracking-[-0.02em] text-white">{t("newOrderPage.registerNewOrder")}</h1>
      <p className="mt-[4px] text-[14px] text-white/50">
        {t("newOrderPage.subtitle")}
      </p>

      {error && <p className="mt-[16px] rounded-[8px] bg-red-500/10 px-[12px] py-[8px] text-[13px] text-red-300">{error}</p>}

      <form onSubmit={handleSubmit} className="mt-[20px] w-full max-w-[680px] space-y-[18px] rounded-[16px] border border-white/[0.08] bg-[#111212] p-[16px] sm:p-[22px]">
        <div ref={suggestionBoxRef} className="relative">
          <label className="mb-[7px] block text-[13px] font-[600] text-white/80">
            {t("newOrderPage.customerLabel")} <span className="text-[#ff4b00]">*</span>
          </label>
          <div className="relative">
            <input
              required
              value={customerName}
              onChange={(e) => {
                setCustomerName(e.target.value)
                setMatchedAccount(null)
                setShowSuggestions(true)
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder={t("newOrderPage.customerNamePlaceholder")}
              className="w-full rounded-[10px] border border-white/15 bg-white/[0.03] px-[14px] py-[11px] pr-[38px] text-[14px] text-white outline-none focus:border-[#ff4b00]"
            />
            <Search size={15} className="pointer-events-none absolute right-[13px] top-1/2 -translate-y-1/2 text-white/30" />
          </div>

          {showSuggestions && customerSuggestions.length > 0 && (
            <ul className="absolute z-10 mt-[6px] w-full overflow-hidden rounded-[10px] border border-white/15 bg-[#181919] shadow-xl">
              {customerSuggestions.map((c) => (
                <li key={c.email}>
                  <button
                    type="button"
                    onClick={() => selectCustomerAccount(c)}
                    className="flex w-full min-w-0 flex-col items-start px-[14px] py-[10px] text-left transition-colors hover:bg-white/[0.06]"
                  >
                    <span className="max-w-full truncate text-[13.5px] font-[700] text-white">{c.name || t("newOrderPage.noName")}</span>
                    <span className="max-w-full truncate text-[12px] text-white/50">{c.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-[4px] text-[11.5px] text-white/35">
            {t("newOrderPage.customerSearchHint")}
          </p>
        </div>

        <div>
          <label className="mb-[7px] block text-[13px] font-[600] text-white/80">
            {t("newOrderPage.customerEmailLabel")} <span className="text-[#ff4b00]">*</span>
          </label>
          <input
            type="email"
            required
            value={customerEmail}
            onChange={(e) => {
              setCustomerEmail(e.target.value)
              if (matchedAccount && e.target.value !== matchedAccount.email) setMatchedAccount(null)
            }}
            placeholder={t("newOrderPage.customerEmailPlaceholder")}
            className="w-full rounded-[10px] border border-white/15 bg-white/[0.03] px-[14px] py-[11px] text-[14px] text-white outline-none focus:border-[#ff4b00]"
          />
          {matchedAccount ? (
            <p className="mt-[5px] flex items-center gap-[6px] text-[11.5px] text-emerald-400">
              <UserCheck size={13} />
              {t("newOrderPage.accountLinkedHint")}
            </p>
          ) : (
            <p className="mt-[4px] text-[11.5px] text-white/35">
              {t("newOrderPage.accountAutoLinkHint")}
            </p>
          )}
        </div>

        {matchingAppointments.length > 0 && (
          <div>
            <label className="mb-[7px] flex items-center gap-[7px] text-[13px] font-[600] text-white/80">
              <CalendarClock size={14} className="text-[#ff4b00]" />
              {t("newOrderPage.linkedAppointmentLabel")}
            </label>
            <select
              value={appointmentId}
              onChange={(e) => setAppointmentId(e.target.value)}
              className="w-full rounded-[10px] border border-white/15 bg-white/[0.03] px-[14px] py-[11px] text-[14px] text-white outline-none focus:border-[#ff4b00]"
            >
              <option value="" className="bg-[#111212]">
                {t("newOrderPage.noAppointmentOption")}
              </option>
              {matchingAppointments.map((a) => (
                <option key={a._id} value={a._id} className="bg-[#111212]">
                  {formatApptOption(a, t)}
                </option>
              ))}
            </select>
            <p className="mt-[4px] text-[11.5px] text-white/35">
              {t("newOrderPage.appointmentAutoResolveHint")}
            </p>
          </div>
        )}

        <div>
          <label className="mb-[7px] block text-[13px] font-[600] text-white/80">
            {t("newOrderPage.serviceLabel")} <span className="text-[#ff4b00]">*</span>
          </label>
          <select
            required
            value={service}
            onChange={(e) => setService(e.target.value)}
            className="w-full rounded-[10px] border border-white/15 bg-white/[0.03] px-[14px] py-[11px] text-[14px] text-white outline-none focus:border-[#ff4b00]"
          >
            <option value="" className="bg-[#111212]">
              {t("newOrderPage.selectServicePlaceholder")}
            </option>
            {SERVICES.map((s) => (
              <option key={s} value={s} className="bg-[#111212]">
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-[7px] block text-[13px] font-[600] text-white/80">
            {t("newOrderPage.descriptionLabel")} <span className="text-[#ff4b00]">*</span>
          </label>
          <textarea
            required
            value={specification}
            onChange={(e) => setSpecification(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder={t("newOrderPage.descriptionPlaceholder")}
            className="w-full resize-none rounded-[10px] border border-white/15 bg-white/[0.03] px-[14px] py-[11px] text-[14px] text-white outline-none focus:border-[#ff4b00]"
          />
          <p className="mt-[4px] text-right text-[11px] text-white/35">{specification.length} / 1000</p>
        </div>

        <div>
          <label className="mb-[7px] block text-[13px] font-[600] text-white/80">{t("newOrderPage.expectedDeliveryLabel")}</label>
          <input
            type="date"
            value={expectedDeliveryDate}
            onChange={(e) => setExpectedDeliveryDate(e.target.value)}
            className="w-full max-w-[300px] rounded-[10px] border border-white/15 bg-white/[0.03] px-[14px] py-[11px] text-[14px] text-white outline-none focus:border-[#ff4b00]"
          />
        </div>

        <div>
          <div className="mb-[10px] flex items-center justify-between">
            <label className="block text-[13px] font-[600] text-white/80">
              {t("newOrderPage.itemsLabel")} <span className="text-white/35">({t("newOrderPage.itemsOptionalHint")})</span>
            </label>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-[5px] text-[12px] font-[700] uppercase tracking-[0.02em] text-[#ff4b00] hover:brightness-110"
            >
              <Plus size={13} />
              {t("newOrderPage.addLineButton")}
            </button>
          </div>

          <div className="space-y-[10px]">
            {items.map((item, index) => {
              const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
              return (
                <div key={index} className="rounded-[10px] border border-white/12 bg-white/[0.02] p-[12px]">
                  <div className="flex items-start gap-[10px]">
                    <div className="grid min-w-0 flex-1 grid-cols-2 gap-[8px] sm:grid-cols-[1.7fr_0.7fr_0.8fr_0.9fr_0.7fr]">
                      <input
                        value={item.name}
                        onChange={(e) => updateItem(index, "name", e.target.value)}
                        placeholder={t("newOrderPage.itemNamePlaceholder")}
                        className="col-span-2 w-full min-w-0 rounded-[8px] border border-white/15 bg-white/[0.03] px-[10px] py-[8px] text-[13px] text-white outline-none focus:border-[#ff4b00] sm:col-span-1"
                      />
                      <input
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", e.target.value)}
                        placeholder={t("newOrderPage.itemQuantityPlaceholder")}
                        className="w-full min-w-0 rounded-[8px] border border-white/15 bg-white/[0.03] px-[10px] py-[8px] text-[13px] text-white outline-none focus:border-[#ff4b00]"
                      />
                      <input
                        value={item.unit}
                        onChange={(e) => updateItem(index, "unit", e.target.value)}
                        placeholder={t("newOrderPage.itemUnitPlaceholder")}
                        className="w-full min-w-0 rounded-[8px] border border-white/15 bg-white/[0.03] px-[10px] py-[8px] text-[13px] text-white outline-none focus:border-[#ff4b00]"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(index, "unitPrice", e.target.value)}
                        placeholder={t("newOrderPage.itemPricePlaceholder")}
                        className="w-full min-w-0 rounded-[8px] border border-white/15 bg-white/[0.03] px-[10px] py-[8px] text-[13px] text-white outline-none focus:border-[#ff4b00]"
                      />
                      <select
                        value={item.vatRate}
                        onChange={(e) => updateItem(index, "vatRate", e.target.value)}
                        className="w-full min-w-0 rounded-[8px] border border-white/15 bg-white/[0.03] px-[10px] py-[8px] text-[13px] text-white outline-none focus:border-[#ff4b00]"
                      >
                        {VAT_RATES.map((r) => (
                          <option key={r} value={r} className="bg-[#111212]">
                            {t("newOrderPage.vatOption", { rate: r })}
                          </option>
                        ))}
                      </select>
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="mt-[8px] shrink-0 text-white/40 hover:text-red-400"
                        aria-label={t("newOrderPage.removeLineAriaLabel")}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    placeholder={t("newOrderPage.itemDescriptionPlaceholder")}
                    className="mt-[8px] w-full min-w-0 rounded-[8px] border border-white/10 bg-white/[0.02] px-[10px] py-[7px] text-[12.5px] text-white/80 outline-none focus:border-[#ff4b00]"
                  />
                  {lineTotal > 0 && (
                    <p className="mt-[6px] text-right text-[11.5px] text-white/45">
                      {t("newOrderPage.lineTotalLabel")} <span className="font-[700] text-white/80">{nok(lineTotal)}</span>
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-[12px] rounded-[10px] border border-white/12 bg-white/[0.02] p-[14px]">
            <div className="flex items-center justify-between text-[13px] text-white/60">
              <span>{t("newOrderPage.subtotalLabel")}</span>
              <span className="text-white/85">{nok(totals.subtotal)}</span>
            </div>
            <div className="mt-[8px] flex items-center justify-between gap-[10px] text-[13px] text-white/60">
              <span className="shrink-0">{t("newOrderPage.discountLabel")}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0"
                className="w-full min-w-0 max-w-[130px] rounded-[8px] border border-white/15 bg-white/[0.03] px-[10px] py-[6px] text-right text-[13px] text-white outline-none focus:border-[#ff4b00]"
              />
            </div>
            <div className="mt-[8px] flex items-center justify-between text-[13px] text-white/60">
              <span>{t("newOrderPage.vatLabel")}</span>
              <span className="text-white/85">{nok(totals.vatAmount)}</span>
            </div>
            <div className="mt-[10px] flex items-center justify-between border-t border-white/10 pt-[10px]">
              <span className="text-[13px] font-[700] uppercase tracking-[0.02em] text-white/80">
                {t("newOrderPage.grandTotalLabel")} <span className="normal-case text-white/35">({t("newOrderPage.grandTotalAutoHint")})</span>
              </span>
              <span className="text-[18px] font-[800] text-white">{nok(totals.grandTotal)}</span>
            </div>
          </div>
        </div>

        <div>
          <label className="mb-[7px] block text-[13px] font-[600] text-white/80">{t("newOrderPage.attachmentsLabel")}</label>
          <label
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              addFiles(e.dataTransfer.files)
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-[10px] border border-dashed px-[20px] py-[28px] text-center transition-colors ${
              dragOver ? "border-[#ff4b00] bg-[#ff4b00]/[0.06]" : "border-white/20 hover:border-white/35"
            }`}
          >
            <CloudUpload size={26} className="mb-[8px] text-[#ff4b00]" />
            <p className="text-[13px] font-[700] text-white">{t("newOrderPage.dragDropText")}</p>
            <p className="mt-[2px] text-[12px] text-white/40">{t("newOrderPage.dragDropSubtext")}</p>
            <input type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
          </label>
          {files.length > 0 && (
            <ul className="mt-[10px] space-y-[6px]">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between gap-[8px] rounded-[8px] border border-white/10 bg-white/[0.03] px-[12px] py-[8px]">
                  <span className="flex min-w-0 flex-1 items-center gap-[8px] text-[12.5px] text-white/80">
                    <File size={14} className="shrink-0 text-white/40" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  </span>
                  <button type="button" onClick={() => removeFile(i)} className="shrink-0 text-white/40 hover:text-red-400">
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className="mb-[7px] block text-[13px] font-[600] text-white/80">{t("newOrderPage.internalNoteLabel")}</label>
          <textarea
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder={t("newOrderPage.internalNotePlaceholder")}
            className="w-full resize-none rounded-[10px] border border-white/15 bg-white/[0.03] px-[14px] py-[11px] text-[14px] text-white outline-none focus:border-[#ff4b00]"
          />
        </div>

        <div className="flex gap-[10px] pt-[4px]">
          <button
            type="submit"
            disabled={saving}
            className="rounded-[10px] bg-[#ff4b00] px-[22px] py-[12px] text-[13px] font-[800] uppercase tracking-[0.02em] text-white hover:brightness-110 disabled:opacity-50"
          >
            {saving ? t("newOrderPage.saving") : t("newOrderPage.saveOrderButton")}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-[10px] border border-white/15 px-[22px] py-[12px] text-[13px] font-[700] text-white hover:bg-white/[0.06]"
          >
            {t("common.cancel")}
          </button>
        </div>
      </form>
    </div>
  )
}