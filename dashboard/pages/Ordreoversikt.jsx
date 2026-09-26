"use client"

import { useEffect, useMemo, useState } from "react"
import { getLocale } from "@/lib/i18n/locale"
import { useRouter } from "next/navigation"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Search,
  X,
  CheckCheck,
} from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { api } from "@/lib/api"
import CreateInvoiceModal from "../components/CreateInvoiceModal"
import InvoicePreviewOverlay from "../components/InvoicePreviewOverlay"
import { useTranslation } from "@/lib/i18n"
import AddNoteButton from "@/components/notes/AddNoteButton"

const TABS = [
  { key: "all", labelKey: "orderOverviewPage.tabAll" },
  { key: "pending", labelKey: "status.pending" },
  { key: "approved", labelKey: "status.approved" },
  { key: "rejected", labelKey: "status.rejected" },
  { key: "completed", labelKey: "status.completed" },
]

const STATUS_STYLE = {
  pending:
    "border-[#8b5cf6] bg-[#8b5cf6]/[0.06] text-[#a78bfa]",
  approved:
    "border-[#ff6500] bg-[#ff6500]/[0.03] text-[#ff6500]",
  rejected:
    "border-[#e32920] bg-[#e32920]/[0.04] text-[#ff3d32]",
  completed:
    "border-[#24943c] bg-[#24943c]/[0.08] text-[#5bd470]",
}

function formatDate(value) {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "–"

  return d.toLocaleDateString(getLocale(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

// Guards against stale/malformed dates (e.g. an old record with
// expectedDeliveryDate saved as "") rendering as "Invalid Date".
function isValidDate(value) {
  return Boolean(value) && !Number.isNaN(new Date(value).getTime())
}

// The date column means something different depending on where the order
// is in its life: when it was placed, when it's due, or when it shipped.
function orderDateInfo(order, t) {
  if (order.status === "completed") {
    if (isValidDate(order.completedAt)) return { label: t("orderOverviewPage.dateCompleted"), value: order.completedAt }
    if (isValidDate(order.expectedDeliveryDate)) return { label: t("orderOverviewPage.dateDelivery"), value: order.expectedDeliveryDate }
    return { label: t("orderOverviewPage.dateOrdered"), value: order.createdAt }
  }
  if (order.status === "approved" && isValidDate(order.expectedDeliveryDate)) {
    return { label: t("orderOverviewPage.dateDelivery"), value: order.expectedDeliveryDate }
  }
  return { label: t("orderOverviewPage.dateOrdered"), value: order.createdAt }
}

function ActionButton({
  children,
  onClick,
  disabled,
  title,
  variant = "orange",
  wide = false,
}) {
  const styles = {
    orange:
      "border-[#ff5a00] text-[#ff5a00] hover:bg-[#ff5a00]/10",
    red:
      "border-[#e52b20] text-[#ff372d] hover:bg-[#e52b20]/10",
    green:
      "border-[#2f9c48] text-[#50cd6a] hover:bg-[#2f9c48]/10",
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        "flex h-[42px] items-center justify-center rounded-[5px] border bg-[#101111]",
        "transition-all duration-200",
        "disabled:cursor-not-allowed disabled:opacity-35",
        styles[variant],
        wide ? "gap-[7px] px-[12px]" : "w-[46px]",
      ].join(" ")}
    >
      {children}
    </button>
  )
}

function PaginationButton({
  children,
  active = false,
  disabled = false,
  onClick,
  icon = false,
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex h-[36px] items-center justify-center rounded-[5px] text-[13px]",
        "transition-colors duration-200",
        icon ? "w-[38px] border border-white/[0.08]" : "min-w-[34px]",
        active
          ? "border border-[#ff5a00] bg-[#ff5a00]/[0.06] font-[700] text-[#ff5a00]"
          : "text-white/65 hover:bg-white/[0.05] hover:text-white",
        disabled ? "cursor-not-allowed opacity-25" : "",
      ].join(" ")}
    >
      {children}
    </button>
  )
}

export default function Ordreoversikt() {
  const { t } = useTranslation()
  const { can } = useAuth()
  const router = useRouter()
  // Both roles can decide orders — admin registers them, owner or admin
  // can approve/reject/complete them.
  // Visibility only — the API checks orders.approve/.reject/.complete itself.
  const canApprove = can("orders.approve")
  const canReject = can("orders.reject")
  const canComplete = can("orders.complete")
  const canInvoice = can("invoices.view") || can("invoices.create")
  const canDecide = canApprove || canReject || canComplete || canInvoice

  const [tab, setTab] = useState("all")
  const [search, setSearch] = useState("")
  // ?search= prefills the search (e.g. "Open record" on a note).
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("search")
    if (fromUrl) setSearch(fromUrl)
  }, [])
  const [page, setPage] = useState(1)

  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)

  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [invoiceOrder, setInvoiceOrder] = useState(null)
  const [previewOrder, setPreviewOrder] = useState(null)

  const limit = 10

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)

      try {
        const params = new URLSearchParams({
          page,
          limit,
        })

        if (tab !== "all") {
          params.set("status", tab)
        }

        if (search.trim()) {
          params.set("search", search.trim())
        }

        const data = await api.get(
          `/orders?${params.toString()}`
        )

        if (!cancelled) {
          setOrders(data.orders || [])
          setTotal(data.total || 0)
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    const timer = setTimeout(load, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [tab, search, page])

  const decide = async (id, status) => {
    setBusyId(id)

    try {
      const { order } = await api.patch(
        `/orders/${id}/status`,
        {
          status,
        }
      )

      setOrders((current) =>
        current.map((item) =>
          item._id === id ? order : item
        )
      )
    } catch (err) {
      console.error(err)
    } finally {
      setBusyId(null)
    }
  }

  const totalPages = Math.max(
    1,
    Math.ceil(total / limit)
  )

  const pagination = useMemo(() => {
    if (totalPages <= 6) {
      return Array.from(
        { length: totalPages },
        (_, index) => index + 1
      )
    }

    if (page <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages]
    }

    if (page >= totalPages - 3) {
      return [
        1,
        "...",
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ]
    }

    return [
      1,
      "...",
      page - 1,
      page,
      page + 1,
      "...",
      totalPages,
    ]
  }, [page, totalPages])

  const startItem =
    total === 0 ? 0 : (page - 1) * limit + 1

  const endItem = Math.min(
    page * limit,
    total
  )

  const renderInvoiceButton = (order) => {
    // Waiting orders get a preview only — no real invoice is issued (and
    // no invoice number spent) until the order is actually completed, but
    // seeing the itemized total helps decide whether to approve it.
    if (order.status === "pending") {
      return (
        <ActionButton
          title={t("orderOverviewPage.previewInvoiceTooltip")}
          variant="orange"
          wide
          onClick={() => setPreviewOrder(order)}
        >
          <FileText size={16} strokeWidth={2} />
          <span className="whitespace-nowrap text-[10px] font-[750] uppercase">{t("orderOverviewPage.previewButton")}</span>
        </ActionButton>
      )
    }
    // Approved but not yet completed — no real invoice exists yet (that's
    // only issued once the work is done), but the order is confirmed and
    // payment is expected, so a plain "unpaid" badge stands in for it
    // instead of the pending-only preview or the completed-only button.
    if (order.status === "approved") {
      return (
        <span
          title={t("orderOverviewPage.approvedInvoiceTooltip")}
          className="inline-flex h-[42px] min-w-[92px] items-center justify-center gap-[7px] rounded-[5px] border border-[#ff5a00] bg-[#ff5a00]/[0.06] px-[12px] text-[10px] font-[750] uppercase text-[#ff5a00]"
        >
          <FileText size={14} strokeWidth={2} />
          {t("status.unpaid")}
        </span>
      )
    }
    if (order.status !== "completed") return null
    if (order.invoice) {
      if (!can("invoices.view")) return null
      const isPaid = order.invoice.status === "paid"
      return (
        <ActionButton
          title={isPaid ? t("orderOverviewPage.invoicePaidTooltip") : t("orderOverviewPage.viewInvoiceTooltip")}
          variant={isPaid ? "green" : "orange"}
          wide
          onClick={() => router.push(`/faktura/${order.invoice._id}`)}
        >
          <FileText size={16} strokeWidth={2} />
          <span className="whitespace-nowrap text-[10px] font-[750] uppercase">{isPaid ? t("status.paid") : t("orderOverviewPage.invoiceButton")}</span>
        </ActionButton>
      )
    }
    if (!can("invoices.create")) return null
    return (
      <ActionButton
        title={t("orderOverviewPage.createInvoiceTooltip")}
        variant="green"
        wide
        onClick={() => setInvoiceOrder(order)}
      >
        <FileText size={16} strokeWidth={2} />
        <span className="whitespace-nowrap text-[10px] font-[750] uppercase">{t("orderOverviewPage.invoiceCreateButton")}</span>
      </ActionButton>
    )
  }

  const renderDecisionAction = (order) => {
    if (busyId === order._id) {
      return (
        <span className="text-[11px] text-white/35">
          {t("orderOverviewPage.updating")}
        </span>
      )
    }

    if (order.status === "pending") {
      if (!canApprove && !canReject) return null
      return (
        <div className="flex items-center gap-[10px]">
          {canApprove && (
          <ActionButton
            title={t("orderOverviewPage.approveTooltip")}
            variant="orange"
            onClick={() =>
              decide(order._id, "approved")
            }
          >
            <Check size={20} strokeWidth={2} />
          </ActionButton>
          )}

          {canReject && (
          <ActionButton
            title={t("orderOverviewPage.rejectTooltip")}
            variant="red"
            onClick={() =>
              decide(order._id, "rejected")
            }
          >
            <X size={20} strokeWidth={2} />
          </ActionButton>
          )}
        </div>
      )
    }

    if (order.status === "rejected") {
      if (!canApprove) return null
      return (
        <ActionButton
          title={t("orderOverviewPage.approveAgainTooltip")}
          variant="orange"
          wide
          onClick={() =>
            decide(order._id, "approved")
          }
        >
          <Check size={17} strokeWidth={2} />

          <span className="whitespace-nowrap text-[10px] font-[750] uppercase">
            {t("orderOverviewPage.approveAgainButton")}
          </span>
        </ActionButton>
      )
    }

    if (order.status === "approved") {
      if (!canComplete) return null
      return (
        <ActionButton
          title={t("orderOverviewPage.markCompletedTooltip")}
          variant="green"
          wide
          onClick={() =>
            decide(order._id, "completed")
          }
        >
          <CheckCheck
            size={17}
            strokeWidth={2}
          />

          <span className="whitespace-nowrap text-[10px] font-[750] uppercase">
            {t("orderOverviewPage.completeButton")}
          </span>
        </ActionButton>
      )
    }

    return null
  }

  const renderActions = (order) => {
    const decision = renderDecisionAction(order)
    const invoiceButton = busyId === order._id ? null : renderInvoiceButton(order)

    if (!decision && !invoiceButton) {
      return <span className="text-[12px] text-white/25">—</span>
    }

    return (
      <div className="flex flex-wrap items-center gap-[10px]">
        {decision}
        {invoiceButton}
      </div>
    )
  }

  return (
    <div className="w-full pb-[18px]">
      <div className="flex flex-col gap-[20px] lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[34px] font-[750] leading-[1.05] tracking-[-0.025em] text-white">
            {t("orderOverviewPage.title")}
          </h1>

          <p className="mt-[10px] text-[16px] text-white/55">
            {t("orderOverviewPage.subtitle")}
          </p>
        </div>

        <div className="flex h-[42px] w-full max-w-[330px] items-center gap-[10px] rounded-[7px] border border-white/[0.12] bg-[#111212] px-[13px] lg:mt-[2px]">
          <Search
            size={17}
            strokeWidth={1.7}
            className="shrink-0 text-white/40"
          />

          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder={t("orderOverviewPage.searchPlaceholder")}
            className="min-w-0 flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/30"
          />
        </div>
      </div>

      <div className="mt-[28px] border-b border-white/[0.10]">
        <div className="flex items-center gap-[7px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-[20px] lg:gap-[42px]">
          {TABS.map((item) => {
            const active = tab === item.key

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setTab(item.key)
                  setPage(1)
                }}
                className={[
                  "relative whitespace-nowrap px-[10px] pb-[16px] pt-[4px]",
                  "text-[12px] font-[700] uppercase tracking-[0.015em]",
                  "transition-colors duration-200",
                  active
                    ? "text-[#ff5a00]"
                    : "text-white/60 hover:text-white",
                ].join(" ")}
              >
                {t(item.labelKey)}

                {active && (
                  <span className="absolute bottom-[-1px] left-0 h-[2px] w-full bg-[#ff5a00]" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-[17px] overflow-hidden rounded-[8px] border border-white/[0.10] bg-[#111212]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="h-[61px] border-b border-white/[0.08] bg-white/[0.012]">
                <th className="w-[15%] px-[19px] text-[13px] font-[650] text-white/90">
                  {t("orderOverviewPage.colOrderId")}
                </th>

                <th className="w-[17%] px-[19px] text-[13px] font-[650] text-white/90">
                  {t("orderOverviewPage.colCustomer")}
                </th>

                <th className="w-[17%] px-[19px] text-[13px] font-[650] text-white/90">
                  {t("orderOverviewPage.colService")}
                </th>

                <th className="w-[16%] px-[19px] text-[13px] font-[650] text-white/90">
                  {t("orderOverviewPage.colDate")}
                </th>

                <th className="w-[18%] px-[19px] text-[13px] font-[650] text-white/90">
                  {t("orderOverviewPage.colStatus")}
                </th>

                {canDecide && (
                  <th className="w-[17%] px-[19px] text-[13px] font-[650] text-white/90">
                    {t("orderOverviewPage.colActions")}
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={
                      canDecide ? 6 : 5
                    }
                    className="h-[150px] px-[20px] text-center text-[13px] text-white/35"
                  >
                    {t("orderOverviewPage.loadingOrders")}
                  </td>
                </tr>
              )}

              {!loading &&
                orders.length === 0 && (
                  <tr>
                    <td
                      colSpan={
                        canDecide ? 6 : 5
                      }
                      className="h-[150px] px-[20px] text-center text-[13px] text-white/35"
                    >
                      {t("orderOverviewPage.noOrdersFound")}
                    </td>
                  </tr>
                )}

              {!loading &&
                orders.map((order) => (
                  <tr
                    key={order._id}
                    className="h-[62px] border-b border-white/[0.075] transition-colors last:border-b-0 hover:bg-white/[0.015]"
                  >
                    <td className="px-[19px] text-[14px] font-[450] text-white/75">
                      <span className="inline-flex items-center gap-[10px]">
                        #{order.orderNumber}
                        <AddNoteButton type="order" id={order._id} variant="icon" />
                      </span>
                    </td>

                    <td className="px-[19px] text-[14px] text-white/78">
                      {order.customerName}
                    </td>

                    <td className="px-[19px] text-[14px] text-white/76">
                      {order.service}
                    </td>

                    <td className="px-[19px] text-[14px] text-white/70">
                      {(() => {
                        const info = orderDateInfo(order, t)
                        return (
                          <>
                            {formatDate(info.value)}
                            <span className="ml-[6px] text-[10px] uppercase tracking-[0.03em] text-white/30">
                              {info.label}
                            </span>
                          </>
                        )
                      })()}
                    </td>

                    <td className="px-[19px]">
                      <span
                        className={[
                          "inline-flex min-w-[92px] items-center justify-center",
                          "rounded-[5px] border px-[12px] py-[7px]",
                          "text-[11px] font-[750] leading-none",
                          STATUS_STYLE[
                            order.status
                          ] ||
                            "border-white/20 text-white/50",
                        ].join(" ")}
                      >
                        {order.status
                          ? t(`status.${order.status}`)
                          : order.status?.toUpperCase()}
                      </span>
                    </td>

                    {canDecide && (
                      <td className="px-[19px]">
                        {renderActions(order)}
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="flex min-h-[61px] flex-col gap-[14px] border-t border-white/[0.06] px-[19px] py-[12px] sm:flex-row sm:items-center sm:justify-between sm:py-0">
            <p className="text-[11px] text-white/38">
              {t("orderOverviewPage.paginationSummary", { start: startItem, end: endItem, total })}
            </p>

            <div className="flex items-center gap-[7px]">
              <PaginationButton
                icon
                disabled={page === 1}
                onClick={() =>
                  setPage((current) =>
                    Math.max(
                      1,
                      current - 1
                    )
                  )
                }
              >
                <ChevronLeft size={16} />
              </PaginationButton>

              {pagination.map(
                (item, index) =>
                  item === "..." ? (
                    <span
                      key={`ellipsis-${index}`}
                      className="flex h-[36px] min-w-[30px] items-center justify-center text-[12px] text-white/40"
                    >
                      ...
                    </span>
                  ) : (
                    <PaginationButton
                      key={item}
                      active={page === item}
                      onClick={() =>
                        setPage(item)
                      }
                    >
                      {item}
                    </PaginationButton>
                  )
              )}

              <PaginationButton
                icon
                disabled={
                  page === totalPages
                }
                onClick={() =>
                  setPage((current) =>
                    Math.min(
                      totalPages,
                      current + 1
                    )
                  )
                }
              >
                <ChevronRight size={16} />
              </PaginationButton>
            </div>
          </div>
        )}
      </div>

      {invoiceOrder && (
        <CreateInvoiceModal
          order={invoiceOrder}
          onClose={() => setInvoiceOrder(null)}
          onCreated={(invoice) => {
            setOrders((current) =>
              current.map((o) =>
                o._id === invoiceOrder._id
                  ? { ...o, invoice: { _id: invoice._id, invoiceNumber: invoice.invoiceNumber, status: invoice.status } }
                  : o
              )
            )
            setInvoiceOrder(null)
            router.push(`/faktura/${invoice._id}`)
          }}
        />
      )}

      {previewOrder && (
        <InvoicePreviewOverlay
          order={previewOrder}
          busy={busyId === previewOrder._id}
          onClose={() => setPreviewOrder(null)}
          onDecide={async (id, status) => {
            await decide(id, status)
            setPreviewOrder(null)
          }}
        />
      )}
    </div>
  )
}