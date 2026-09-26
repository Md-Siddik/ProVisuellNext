"use client"

import { useEffect, useState } from "react"
import { getLocale } from "@/lib/i18n/locale"
import { Plus } from "lucide-react"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import AddNoteButton from "@/components/notes/AddNoteButton"

// Stored/matched values stay Norwegian regardless of UI language — the
// server string-matches "Direkte kostnader" for gross-profit aggregation
// (Server/src/routes/reports.js), so only the on-screen label is translated.
const CATEGORIES = ["Direkte kostnader", "Lønn", "Leie", "Verktøy og utstyr", "Markedsføring", "Annet"]
const CATEGORY_LABEL_KEYS = {
  "Direkte kostnader": "expensesPage.categoryDirectCosts",
  "Lønn": "expensesPage.categorySalary",
  "Leie": "expensesPage.categoryRent",
  "Verktøy og utstyr": "expensesPage.categoryToolsEquipment",
  "Markedsføring": "expensesPage.categoryMarketing",
  "Annet": "expensesPage.categoryOther",
}

function nok(value = 0) {
  return `kr ${Math.round(Number(value) || 0).toLocaleString("no-NO")},-`
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function Utgifter() {
  const { t } = useTranslation()
  const categoryLabel = (value) => (CATEGORY_LABEL_KEYS[value] ? t(CATEGORY_LABEL_KEYS[value]) : value)
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState(CATEGORIES[0])
  const [date, setDate] = useState(todayISO)
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const { expenses } = await api.get("/expenses")
      setExpenses(expenses)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) {
      setError(t("expensesPage.amountRequiredError"))
      return
    }
    if (!date) {
      setError(t("expensesPage.dateRequiredError"))
      return
    }
    setSaving(true)
    try {
      const { expense } = await api.post("/expenses", {
        amount: numericAmount,
        category,
        date,
        note: note.trim(),
      })
      setExpenses((prev) => [expense, ...prev])
      setAmount("")
      setNote("")
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1 className="text-[26px] font-[800] tracking-[-0.02em] text-white">{t("expensesPage.title")}</h1>
      <p className="mt-[4px] text-[14px] text-white/50">{t("expensesPage.subtitle")}</p>

      {error && <p className="mt-[16px] rounded-[8px] bg-red-500/10 px-[12px] py-[8px] text-[13px] text-red-300">{error}</p>}

      <form
        onSubmit={handleSubmit}
        className="mt-[20px] grid max-w-[820px] grid-cols-1 gap-[14px] rounded-[16px] border border-white/[0.08] bg-[#111212] p-[22px] sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]"
      >
        <div>
          <label className="mb-[7px] block text-[13px] font-[600] text-white/80">
            {t("expensesPage.amountLabel")} <span className="text-[#ff4b00]">*</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t("expensesPage.amountPlaceholder")}
            className="w-full rounded-[10px] border border-white/15 bg-white/[0.03] px-[14px] py-[11px] text-[14px] text-white outline-none focus:border-[#ff4b00]"
          />
        </div>

        <div>
          <label className="mb-[7px] block text-[13px] font-[600] text-white/80">{t("expensesPage.category")}</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-[10px] border border-white/15 bg-white/[0.03] px-[14px] py-[11px] text-[14px] text-white outline-none focus:border-[#ff4b00]"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-[#111212]">
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-[7px] block text-[13px] font-[600] text-white/80">
            {t("common.date")} <span className="text-[#ff4b00]">*</span>
          </label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-[10px] border border-white/15 bg-white/[0.03] px-[14px] py-[11px] text-[14px] text-white outline-none focus:border-[#ff4b00]"
          />
        </div>

        <div className="flex items-end sm:col-span-2 lg:col-span-1">
          <button
            type="submit"
            disabled={saving}
            className="flex h-[45px] w-full items-center justify-center gap-[8px] rounded-[10px] bg-[#ff4b00] px-[20px] text-[13px] font-[800] uppercase tracking-[0.02em] text-white hover:brightness-110 disabled:opacity-50 lg:w-auto"
          >
            <Plus size={15} />
            {saving ? t("expensesPage.saving") : t("common.add")}
          </button>
        </div>

        <div className="sm:col-span-2 lg:col-span-4">
          <label className="mb-[7px] block text-[13px] font-[600] text-white/80">{t("expensesPage.noteLabel")}</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("expensesPage.notePlaceholder")}
            className="w-full rounded-[10px] border border-white/15 bg-white/[0.03] px-[14px] py-[11px] text-[14px] text-white outline-none focus:border-[#ff4b00]"
          />
        </div>
      </form>

      <div className="mt-[20px] overflow-x-auto rounded-[14px] border border-white/[0.08] bg-[#111212]">
        <table className="w-full min-w-[620px] text-left text-[13.5px]">
          <thead>
            <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-[0.04em] text-white/40">
              <th className="px-[18px] py-[13px] font-[600]">{t("common.date")}</th>
              <th className="px-[18px] py-[13px] font-[600]">{t("expensesPage.category")}</th>
              <th className="px-[18px] py-[13px] font-[600]">{t("expensesPage.tableNote")}</th>
              <th className="px-[18px] py-[13px] font-[600]">{t("common.amount")}</th>
              <th className="w-[1%] px-[12px] py-[13px]" aria-label={t("notesPage.notes")} />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-[18px] py-[20px] text-center text-white/40">
                  {t("expensesPage.loadingExpenses")}
                </td>
              </tr>
            )}
            {!loading && expenses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-[18px] py-[20px] text-center text-white/40">
                  {t("expensesPage.noExpenses")}
                </td>
              </tr>
            )}
            {expenses.map((e) => (
              <tr key={e._id} className="border-b border-white/[0.06] last:border-0">
                <td className="px-[18px] py-[13px] text-white/70">{new Date(e.date).toLocaleDateString(getLocale())}</td>
                <td className="px-[18px] py-[13px] text-white/80">{t(CATEGORY_LABEL_KEYS[e.category]) || e.category}</td>
                <td className="px-[18px] py-[13px] text-white/50">{e.note || "—"}</td>
                <td className="px-[18px] py-[13px] font-[700] text-white">{nok(e.amount)}</td>
                <td className="px-[12px] py-[8px]">
                  <AddNoteButton type="expense" id={e._id} variant="icon" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}