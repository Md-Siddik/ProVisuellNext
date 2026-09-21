"use client"

import { useEffect, useRef, useState } from "react"
import { getLocale } from "@/lib/i18n/locale"
import { useRouter } from "next/navigation"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertTriangle,
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  Download,
  FileText,
  Landmark,
  PieChart as PieIcon,
  TrendingUp,
  ChevronDown,
} from "lucide-react"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"

const ORANGE = "#ff4b00"
const GREEN = "#3ee23e"
const RED = "#ff3b30"
const VIOLET = "#8b5cf6"

// Real per-day values from the report's daily breakdown, keyed the same
// way as the KPI cards. Needs at least 2 points to draw a line.
function sparkPoints(daily, key) {
  const values = (daily || []).map((d) => Number(d[key]) || 0)
  if (values.length === 0) return [0, 0]
  if (values.length === 1) return [values[0], values[0]]
  return values
}

const SPARK_KEY = {
  revenue: "revenue",
  costs: "cost",
  grossProfit: "grossProfit",
  netResult: "netResult",
}

function nok(value = 0) {
  return `kr ${Math.round(Number(value) || 0).toLocaleString("no-NO")},-`
}

function monthLabel(monthStr) {
  if (!monthStr) return ""

  const [year, month] = monthStr.split("-").map(Number)

  const text = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
    getLocale(),
    {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }
  )

  return text.charAt(0).toUpperCase() + text.slice(1)
}

function formatDueDate(value) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString(getLocale(), { day: "2-digit", month: "2-digit", year: "numeric" })
}

function shortDate(dateString) {
  if (!dateString) return ""

  const date = new Date(`${dateString}T00:00:00`)

  return date.toLocaleDateString(getLocale(), {
    day: "numeric",
    month: "short",
  })
}

function percentText(value = 0) {
  return `${Math.abs(Number(value) || 0).toLocaleString("no-NO", {
    maximumFractionDigits: 1,
  })}%`
}

function SparkLine({ points, color }) {
  const width = 176
  const height = 38
  const padding = 2

  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1

  const coordinates = points
    .map((value, index) => {
      const x =
        padding + (index / (points.length - 1)) * (width - padding * 2)

      const y =
        height -
        padding -
        ((value - min) / range) * (height - padding * 2)

      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-[37px] w-full overflow-visible"
      preserveAspectRatio="none"
    >
      <polyline
        points={coordinates}
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  change,
  type,
  points,
  goodWhenUp = true,
}) {
  const numericChange = Number(change) || 0
  const up = numericChange >= 0

  const positive =
    numericChange === 0 ? true : goodWhenUp ? up : !up

  const statusColor = positive ? GREEN : RED
  const sparkColor =
    type === "revenue"
      ? ORANGE
      : type === "costs"
        ? RED
        : GREEN

  const { t } = useTranslation()

  return (
    <div className="relative min-h-[186px] overflow-hidden rounded-[12px] border border-white/[0.13] bg-[#111313] px-[23px] pb-[14px] pt-[20px]">
      <div className="flex items-start justify-between">
        <p className="pt-[4px] text-[15px] font-[400] text-white/80">
          {label}
        </p>

        <span className="flex h-[37px] w-[37px] items-center justify-center rounded-[8px] border border-[#ff4b00]/40 bg-[#ff4b00]/10 text-[#ff4b00]">
          <Icon size={18} strokeWidth={1.8} />
        </span>
      </div>

      <p className="mt-[10px] whitespace-nowrap text-[28px] font-[750] leading-none tracking-[-0.025em] text-white xl:text-[30px]">
        {nok(value)}
      </p>

      <div className="mt-[15px] flex items-center gap-[4px] text-[13px]">
        <span
          className="font-[700]"
          style={{ color: statusColor }}
        >
          {up ? "↑" : "↓"}
          {percentText(numericChange)}
        </span>

        <span className="text-white/55">{t("reportsPage.vsLastMonth")}</span>
      </div>

      <div className="mt-[13px] h-[38px] w-full">
        <SparkLine
          points={points?.length ? points : [0, 0]}
          color={sparkColor}
        />
      </div>
    </div>
  )
}

// Unlike the KPI cards above, this isn't a this-month-vs-last-month flow
// figure — it's a live balance of everything currently unpaid across all
// customers, so it has no sparkline or month-over-month percentage.
function DueCard({ value, count, onClick }) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!count}
      className="relative min-h-[186px] overflow-hidden rounded-[12px] border border-[#ff5a00]/35 bg-[#ff5a00]/[0.05] px-[23px] pb-[14px] pt-[20px] text-left transition-colors hover:border-[#ff5a00]/60 disabled:cursor-default disabled:hover:border-[#ff5a00]/35"
    >
      <div className="flex items-start justify-between">
        <p className="pt-[4px] text-[15px] font-[400] text-white/80">{t("reportsPage.outstandingUnpaid")}</p>
        <span className="flex h-[37px] w-[37px] items-center justify-center rounded-[8px] border border-[#ff5a00]/40 bg-[#ff5a00]/10 text-[#ff5a00]">
          <AlertTriangle size={18} strokeWidth={1.8} />
        </span>
      </div>

      <p className="mt-[10px] whitespace-nowrap text-[28px] font-[750] leading-none tracking-[-0.025em] text-white xl:text-[30px]">
        {nok(value)}
      </p>

      <div className="mt-[15px] flex items-center gap-[4px] text-[13px]">
        <span className="font-[700] text-[#ff5a00]">{count}</span>
        <span className="text-white/55">
          {count === 1 ? t("reportsPage.unpaidInvoiceSingular") : t("reportsPage.unpaidInvoicePlural")}
        </span>
      </div>

      <p className="mt-[13px] text-[12px] text-white/40">
        {count > 0 ? t("reportsPage.clickForDetails") : t("reportsPage.noOutstandingInvoices")}
      </p>
    </button>
  )
}

function CustomBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="min-w-[165px] rounded-[9px] border border-white/[0.12] bg-[#181919] px-[13px] py-[10px] shadow-xl">
      <p className="mb-[7px] text-[12px] font-[650] text-white">
        {shortDate(label)}
      </p>

      {payload.map((item) => (
        <div
          key={item.dataKey}
          className="flex items-center justify-between gap-[20px] py-[2px] text-[11px]"
        >
          <span className="flex items-center gap-[6px] text-white/60">
            <span
              className="h-[7px] w-[7px] rounded-[2px]"
              style={{ backgroundColor: item.color }}
            />

            {item.name}
          </span>

          <span className="font-[650] text-white">{nok(item.value)}</span>
        </div>
      ))}
    </div>
  )
}

function CustomPieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null

  const item = payload[0]

  return (
    <div className="rounded-[9px] border border-white/[0.12] bg-[#181919] px-[12px] py-[9px] shadow-xl">
      <p className="text-[11px] text-white/60">{item.name}</p>
      <p className="mt-[3px] text-[13px] font-[700] text-white">
        {nok(item.value)}
      </p>
    </div>
  )
}

function SummaryRow({
  label,
  current,
  previous,
  changePercent,
  costRow = false,
}) {
  const difference = Number(current || 0) - Number(previous || 0)
  const percent = Number(changePercent || 0)

  const differenceGood = costRow ? difference <= 0 : difference >= 0
  const percentGood = costRow ? percent <= 0 : percent >= 0

  return (
    <tr className="border-b border-white/[0.09] last:border-b-0">
      <td className="px-[24px] py-[13px] text-[14px] text-white/80">
        {label}
      </td>

      <td className="px-[24px] py-[13px] text-[14px] text-white/80">
        {nok(current)}
      </td>

      <td className="px-[24px] py-[13px] text-[14px] text-white/70">
        {nok(previous)}
      </td>

      <td
        className={`px-[24px] py-[13px] text-[14px] font-[650] ${
          differenceGood ? "text-[#3ee23e]" : "text-[#ff3b30]"
        }`}
      >
        {difference >= 0 ? "" : "-"}
        {nok(Math.abs(difference))}
      </td>

      <td
        className={`px-[24px] py-[13px] text-[14px] font-[650] ${
          percentGood ? "text-[#3ee23e]" : "text-[#ff3b30]"
        }`}
      >
        {percent >= 0 ? "↑" : "↓"} {percentText(percent)}
      </td>
    </tr>
  )
}

export default function Rapporter() {
  const { t } = useTranslation()
  const router = useRouter()
  const [month, setMonth] = useState(() =>
    new Date().toISOString().slice(0, 7)
  )

  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  const [showDue, setShowDue] = useState(false)
  const dueSectionRef = useRef(null)
  const [loading, setLoading] = useState(true)

  const monthInputRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError("")

      try {
        const result = await api.get(`/reports/monthly?month=${month}`)

        if (!cancelled) {
          setData(result)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || t("reportsPage.loadReportError"))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [month])

  const openMonthPicker = () => {
    const input = monthInputRef.current

    if (!input) return

    if (typeof input.showPicker === "function") {
      input.showPicker()
    } else {
      input.click()
    }
  }

  const exportReport = () => {
    if (!data) return

    const pct = (v) => `${v >= 0 ? "+" : ""}${v}%`

    const rows = [
      [`ProVisuell — ${t("reportsPage.pageTitle")}`],
      [monthLabel(month)],
      [`${t("reportsPage.export")}: ${new Date().toLocaleString(getLocale(), { dateStyle: "long", timeStyle: "short" })}`],
      [],
      [t("reportsPage.tableKeyFigures").toUpperCase(), t("reportsPage.tableThisMonth"), t("reportsPage.tableLastMonth"), t("reportsPage.tableChange")],
      [t("reportsPage.kpiRevenue"), nok(data.totals.revenue), nok(data.previous.revenue), pct(data.changeVsPrevMonth.revenue)],
      [t("reportsPage.kpiCosts"), nok(data.totals.costs), nok(data.previous.costs), pct(data.changeVsPrevMonth.costs)],
      [t("reportsPage.kpiGrossProfit"), nok(data.totals.grossProfit), nok(data.previous.grossProfit), pct(data.changeVsPrevMonth.grossProfit)],
      [t("reportsPage.kpiNetResult"), nok(data.totals.netResult), nok(data.previous.netResult), pct(data.changeVsPrevMonth.netResult)],
      [],
      [t("reportsPage.csvOutstandingHeading")],
      [`${t("reportsPage.outstanding")}: ${nok(data.totals.due)} (${data.dueInvoiceCount} ${data.dueInvoiceCount === 1 ? t("reportsPage.unpaidInvoiceSingular") : t("reportsPage.unpaidInvoicePlural")})`],
      [],
      [t("reportsPage.dueTableInvoice"), t("reportsPage.dueTableCustomer"), t("reportsPage.dueTableOrder"), t("reportsPage.dueTableDueDate"), t("common.status"), t("common.amount")],
      ...(data.dueInvoices || []).map((inv) => [
        inv.invoiceNumber,
        inv.customerName,
        inv.orderNumber || "—",
        formatDueDate(inv.dueDate),
        t(`status.${inv.status}`),
        nok(inv.amount),
      ]),
      [],
      [t("reportsPage.csvRevenueByServiceHeading")],
      [t("orderOverviewPage.colService"), t("common.amount"), t("reportsPage.csvShare")],
      ...(data.revenueByService || []).map((s) => [s.service, nok(s.amount), `${s.percent}%`]),
      [],
      [t("reportsPage.csvDailyHeading")],
      [t("common.date"), t("reportsPage.revenue"), t("reportsPage.costs")],
      ...(data.daily || []).map((row) => [
        new Date(`${row.date}T00:00:00`).toLocaleDateString(getLocale(), { day: "2-digit", month: "2-digit", year: "numeric" }),
        nok(row.revenue || 0),
        nok(row.cost || 0),
      ]),
    ]

    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`)
          .join(";")
      )
      .join("\n")

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    })

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")

    anchor.href = url
    anchor.download = `provisuell-rapport-${month}.csv`

    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()

    URL.revokeObjectURL(url)
  }

  const hasDailyData = Boolean(data?.daily?.length)

  // Cost, profit and outstanding money, each in a genuinely distinct hue
  // (not shades of the same orange) so the breakdown is easy to read at a
  // glance rather than by squinting at similar tones.
  const financialBreakdown = data
    ? [
        { label: t("reportsPage.costs"), value: data.totals.costs, color: RED },
        { label: t("reportsPage.kpiNetResult"), value: Math.max(0, data.totals.netResult), color: GREEN },
        { label: t("reportsPage.outstanding"), value: data.totals.due, color: VIOLET },
      ].filter((d) => d.value > 0)
    : []
  const financialTotal = financialBreakdown.reduce((sum, d) => sum + d.value, 0)
  const hasFinancialData = financialBreakdown.length > 0

  const updateDate = data?.updatedAt
    ? new Date(data.updatedAt)
    : new Date()

  const updateText = updateDate.toLocaleString(getLocale(), {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div className="w-full pb-[24px]">
      <div className="flex flex-col gap-[20px] xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-[32px] font-[750] leading-none tracking-[-0.025em] text-white">
            {t("reportsPage.pageTitle")}
          </h1>

          <p className="mt-[10px] text-[15px] text-white/65">
            {t("reportsPage.pageSubtitle")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-[20px]">
          <div
            onClick={openMonthPicker}
            className="relative flex h-[51px] min-w-[196px] cursor-pointer items-center gap-[12px] rounded-[9px] border border-white/[0.16] bg-[#111212] px-[20px] text-white transition-colors hover:border-white/25"
          >
            <CalendarDays size={19} strokeWidth={1.8} />

            <span className="flex-1 text-[14px] font-[600]">
              {monthLabel(month)}
            </span>

            <ChevronDown
              size={16}
              className="text-white/70"
              strokeWidth={1.8}
            />

            <input
              ref={monthInputRef}
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="pointer-events-none absolute h-0 w-0 opacity-0"
              aria-label={t("reportsPage.selectMonthAriaLabel")}
            />
          </div>

          <button
            type="button"
            onClick={exportReport}
            disabled={!data}
            className="flex h-[51px] min-w-[168px] items-center justify-center gap-[10px] rounded-[7px] bg-[#ff4b00] px-[25px] text-[13px] font-[750] uppercase tracking-[0.015em] text-white transition-colors hover:bg-[#ff5a16] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={17} strokeWidth={2} />
            {t("reportsPage.export")}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-[18px] rounded-[9px] border border-red-500/20 bg-red-500/10 px-[14px] py-[10px] text-[13px] text-red-300">
          {error}
        </div>
      )}

      {loading && !data && (
        <div className="mt-[20px] rounded-[12px] border border-white/[0.08] bg-[#111212] px-[18px] py-[24px] text-[13px] text-white/45">
          {t("reportsPage.loadingReport")}
        </div>
      )}

      {data && (
        <>
          <div className="mt-[22px] grid grid-cols-1 gap-[18px] sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard
              icon={CircleDollarSign}
              label={t("reportsPage.kpiRevenue")}
              value={data.totals.revenue}
              change={data.changeVsPrevMonth.revenue}
              type="revenue"
              points={sparkPoints(data.daily, SPARK_KEY.revenue)}
            />

            <KpiCard
              icon={CreditCard}
              label={t("reportsPage.kpiCosts")}
              value={data.totals.costs}
              change={data.changeVsPrevMonth.costs}
              type="costs"
              goodWhenUp={false}
              points={sparkPoints(data.daily, SPARK_KEY.costs)}
            />

            <KpiCard
              icon={PieIcon}
              label={t("reportsPage.kpiGrossProfit")}
              value={data.totals.grossProfit}
              change={data.changeVsPrevMonth.grossProfit}
              type="grossProfit"
              points={sparkPoints(data.daily, SPARK_KEY.grossProfit)}
            />

            <KpiCard
              icon={Landmark}
              label={t("reportsPage.kpiNetResult")}
              value={data.totals.netResult}
              change={data.changeVsPrevMonth.netResult}
              type="netResult"
              points={sparkPoints(data.daily, SPARK_KEY.netResult)}
            />

            <DueCard
              value={data.totals.due}
              count={data.dueInvoiceCount}
              onClick={() => {
                setShowDue(true)
                requestAnimationFrame(() => dueSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
              }}
            />
          </div>

          <div className="mt-[20px] grid grid-cols-1 gap-[18px] xl:grid-cols-[1.48fr_1fr]">
            <section className="min-h-[329px] rounded-[12px] border border-white/[0.13] bg-[#111313] px-[23px] pb-[18px] pt-[23px]">
              <div className="flex flex-wrap items-start justify-between gap-[12px]">
                <div>
                  <h2 className="text-[20px] font-[700] text-white">
                    {t("reportsPage.revenueVsCosts")}
                  </h2>

                  <div className="mt-[18px] flex items-center gap-[25px] text-[13px] text-white/70">
                    <span className="flex items-center gap-[8px]">
                      <span className="h-[11px] w-[20px] rounded-[2px] bg-[#ff4b00]" />
                      {t("reportsPage.revenue")}
                    </span>

                    <span className="flex items-center gap-[8px]">
                      <span className="h-[11px] w-[20px] rounded-[2px] bg-[#716966]" />
                      {t("reportsPage.costs")}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="flex h-[42px] min-w-[108px] items-center justify-between gap-[18px] rounded-[8px] border border-white/[0.14] bg-[#151616] px-[14px] text-[13px] text-white/75"
                >
                  {t("reportsPage.daily")}
                  <ChevronDown size={15} />
                </button>
              </div>

              {!hasDailyData ? (
                <div className="flex h-[220px] items-center justify-center text-center text-[13px] text-white/40">
                  {t("reportsPage.noChartData")}
                </div>
              ) : (
                <div className="mt-[10px] h-[235px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.daily}
                      margin={{
                        top: 8,
                        right: 0,
                        left: -10,
                        bottom: 0,
                      }}
                      barGap={5}
                    >
                      <CartesianGrid
                        vertical={false}
                        stroke="rgba(255,255,255,0.08)"
                      />

                      <XAxis
                        dataKey="date"
                        axisLine={{
                          stroke: "rgba(255,255,255,0.12)",
                        }}
                        tickLine={false}
                        minTickGap={40}
                        tick={{
                          fill: "rgba(255,255,255,0.64)",
                          fontSize: 11,
                        }}
                        tickFormatter={shortDate}
                      />

                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        width={55}
                        tick={{
                          fill: "rgba(255,255,255,0.62)",
                          fontSize: 11,
                        }}
                        tickFormatter={(value) =>
                          value === 0
                            ? "0"
                            : `${Math.round(value / 1000)}k`
                        }
                      />

                      <Tooltip
                        content={<CustomBarTooltip />}
                        cursor={{
                          fill: "rgba(255,255,255,0.025)",
                        }}
                      />

                      <Bar
                        dataKey="revenue"
                        name={t("reportsPage.revenue")}
                        fill="#ff4b00"
                        radius={[3, 3, 0, 0]}
                        maxBarSize={15}
                      />

                      <Bar
                        dataKey="cost"
                        name={t("reportsPage.costs")}
                        fill="#716966"
                        radius={[3, 3, 0, 0]}
                        maxBarSize={15}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="min-h-[329px] rounded-[12px] border border-white/[0.13] bg-[#111313] px-[23px] pb-[20px] pt-[23px]">
              <h2 className="text-[20px] font-[700] text-white">
                {t("reportsPage.financialBreakdown")}
              </h2>
              <p className="mt-[4px] text-[12.5px] text-white/45">
                {t("reportsPage.financialBreakdownSubtitle")}
              </p>

              {!hasFinancialData ? (
                <div className="flex h-[245px] items-center justify-center text-center text-[13px] text-white/40">
                  {t("reportsPage.noFinancialData")}
                </div>
              ) : (
                <div className="mt-[16px] flex min-h-[235px] flex-col items-center gap-[15px] md:flex-row xl:gap-[18px]">
                  <div className="h-[220px] w-full min-w-0 md:w-[55%]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={financialBreakdown}
                          dataKey="value"
                          nameKey="label"
                          cx="50%"
                          cy="50%"
                          innerRadius="48%"
                          outerRadius="74%"
                          stroke="rgba(255,255,255,0.04)"
                          strokeWidth={1}
                          paddingAngle={2}
                        >
                          {financialBreakdown.map((entry) => (
                            <Cell key={entry.label} fill={entry.color} />
                          ))}
                        </Pie>

                        <Tooltip content={<CustomPieTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="w-full flex-1 md:w-[45%]">
                    <ul className="space-y-[20px]">
                      {financialBreakdown.map((entry) => (
                        <li key={entry.label} className="flex flex-col gap-[3px]">
                          <span className="flex items-center gap-[9px]">
                            <span
                              className="h-[12px] w-[12px] shrink-0 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />

                            <span className="text-[13px] text-white/70">{entry.label}</span>
                          </span>

                          <span className="pl-[21px] text-[13px] font-[650] text-white/80">
                            {nok(entry.value)}
                            <span className="ml-[6px] text-white/40">
                              ({financialTotal ? Math.round((entry.value / financialTotal) * 100) : 0}%)
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </section>
          </div>

          <section className="mt-[20px] overflow-hidden rounded-[12px] border border-white/[0.13] bg-[#111313]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/[0.12]">
                    <th className="px-[24px] py-[15px] text-[13px] font-[650] text-white">
                      {t("reportsPage.tableKeyFigures")}
                    </th>

                    <th className="px-[24px] py-[15px] text-[13px] font-[650] text-white">
                      {t("reportsPage.tableThisMonth")}
                    </th>

                    <th className="px-[24px] py-[15px] text-[13px] font-[650] text-white">
                      {t("reportsPage.tableLastMonth")}
                    </th>

                    <th className="px-[24px] py-[15px] text-[13px] font-[650] text-white">
                      {t("reportsPage.tableChange")}
                    </th>

                    <th className="px-[24px] py-[15px] text-[13px] font-[650] text-white">
                      {t("reportsPage.tableChangePercent")}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  <SummaryRow
                    label={t("reportsPage.kpiRevenue")}
                    current={data.totals.revenue}
                    previous={data.previous.revenue}
                    changePercent={data.changeVsPrevMonth.revenue}
                  />

                  <SummaryRow
                    label={t("reportsPage.kpiCosts")}
                    current={data.totals.costs}
                    previous={data.previous.costs}
                    changePercent={data.changeVsPrevMonth.costs}
                    costRow
                  />

                  <SummaryRow
                    label={t("reportsPage.kpiGrossProfit")}
                    current={data.totals.grossProfit}
                    previous={data.previous.grossProfit}
                    changePercent={data.changeVsPrevMonth.grossProfit}
                  />

                  <SummaryRow
                    label={t("reportsPage.kpiNetResult")}
                    current={data.totals.netResult}
                    previous={data.previous.netResult}
                    changePercent={data.changeVsPrevMonth.netResult}
                  />
                </tbody>
              </table>
            </div>
          </section>

          {data.dueInvoiceCount > 0 && (
            <section
              ref={dueSectionRef}
              className="mt-[20px] overflow-hidden rounded-[12px] border border-[#ff5a00]/25 bg-[#111313]"
            >
              <button
                type="button"
                onClick={() => setShowDue((v) => !v)}
                className="flex w-full items-center justify-between gap-[12px] px-[24px] py-[18px] text-left"
              >
                <span className="flex items-center gap-[10px]">
                  <AlertTriangle size={18} className="text-[#ff5a00]" />
                  <span className="text-[16px] font-[700] text-white">
                    {t("reportsPage.dueInvoicesHeading", {
                      count: data.dueInvoiceCount,
                      amount: nok(data.totals.due),
                    })}
                  </span>
                </span>
                <ChevronDown
                  size={18}
                  className={`text-white/60 transition-transform ${showDue ? "rotate-180" : ""}`}
                />
              </button>

              {showDue && (
                <div className="overflow-x-auto border-t border-white/[0.08]">
                  <table className="w-full min-w-[700px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-white/[0.1]">
                        <th className="px-[24px] py-[12px] text-[12px] font-[650] text-white/60">{t("reportsPage.dueTableInvoice")}</th>
                        <th className="px-[24px] py-[12px] text-[12px] font-[650] text-white/60">{t("reportsPage.dueTableCustomer")}</th>
                        <th className="px-[24px] py-[12px] text-[12px] font-[650] text-white/60">{t("reportsPage.dueTableOrder")}</th>
                        <th className="px-[24px] py-[12px] text-[12px] font-[650] text-white/60">{t("reportsPage.dueTableDueDate")}</th>
                        <th className="px-[24px] py-[12px] text-[12px] font-[650] text-white/60">{t("common.amount")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.dueInvoices.map((inv) => (
                        <tr
                          key={inv._id}
                          onClick={() => router.push(`/faktura/${inv._id}`)}
                          className="cursor-pointer border-b border-white/[0.06] last:border-0 hover:bg-white/[0.02]"
                        >
                          <td className="flex items-center gap-[8px] px-[24px] py-[12px] text-[13px] text-white/80">
                            <FileText size={13} className="text-white/40" />
                            {inv.invoiceNumber}
                          </td>
                          <td className="px-[24px] py-[12px] text-[13px] text-white/80">{inv.customerName}</td>
                          <td className="px-[24px] py-[12px] text-[13px] text-white/50">{inv.orderNumber || "—"}</td>
                          <td className="px-[24px] py-[12px] text-[13px] text-white/50">{formatDueDate(inv.dueDate)}</td>
                          <td className="px-[24px] py-[12px] text-[13px] font-[700] text-[#ff5a00]">{nok(inv.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          <p className="mt-[20px] text-center text-[12px] text-white/42">
            {t("reportsPage.lastUpdated", { date: updateText })}
          </p>
        </>
      )}
    </div>
  )
}