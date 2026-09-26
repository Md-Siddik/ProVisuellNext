"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CalendarClock, CheckCheck, CheckCircle2, Clock, XCircle } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { openMeetingRoom } from "@/lib/appointments/joinMeeting"
import { api } from "@/lib/api"
import UnreadBadge from "../../components/UnreadBadge"
import { useUnreadMessages } from "@/hooks/useUnreadMessages"
import { useTranslation } from "@/lib/i18n"
import PinnedNotesCard from "../../components/notes/PinnedNotesCard"


function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-[14px] border border-white/[0.08] bg-[#111212] p-[20px]">
      <div className={`mb-[10px] flex h-[38px] w-[38px] items-center justify-center rounded-[10px] ${tone}`}>
        <Icon size={18} />
      </div>
      <p className="text-[26px] font-[800] leading-none text-white">{value}</p>
      <p className="mt-[6px] text-[13px] text-white/50">{label}</p>
    </div>
  )
}

export default function Overview() {
  const { t } = useTranslation()
  const { profile, role, can } = useAuth()
  const canSeeOrders = can("orders.view")
  const [roomError, setRoomError] = useState("")
  const base = role === "owner" ? "/dashboard/owner" : "/dashboard/admin"
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, completed: 0 })
  const [loading, setLoading] = useState(true)
  const unreadMessages = useUnreadMessages()

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!canSeeOrders) {
        setLoading(false)
        return
      }
      try {
        const [pending, approved, rejected, completed] = await Promise.all([
          api.get("/orders?status=pending&limit=1"),
          api.get("/orders?status=approved&limit=1"),
          api.get("/orders?status=rejected&limit=1"),
          api.get("/orders?status=completed&limit=1"),
        ])
        if (!cancelled) {
          setCounts({ pending: pending.total, approved: approved.total, rejected: rejected.total, completed: completed.total })
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [canSeeOrders])

  return (
    <div>
      <h1 className="text-[26px] font-[800] tracking-[-0.02em] text-white">
        {t("overview.greeting", { name: profile?.name?.split(" ")[0] || t("overview.greetingFallback") })}
      </h1>
      <p className="mt-[6px] text-[14px] text-white/50">{t("overview.subtitle")}</p>

      {canSeeOrders && (
      <div className="mt-[22px] grid grid-cols-2 gap-[14px] lg:grid-cols-4">
        <StatCard icon={Clock} label={t("overview.statPending")} value={loading ? "…" : counts.pending} tone="bg-orange-500/15 text-orange-400" />
        <StatCard icon={CheckCircle2} label={t("overview.statApproved")} value={loading ? "…" : counts.approved} tone="bg-emerald-500/15 text-emerald-400" />
        <StatCard icon={CheckCheck} label={t("overview.statCompleted")} value={loading ? "…" : counts.completed} tone="bg-emerald-500/15 text-emerald-400" />
        <StatCard icon={XCircle} label={t("overview.statRejected")} value={loading ? "…" : counts.rejected} tone="bg-red-500/15 text-red-400" />
      </div>
      )}

      {role === "owner" && (
        <div className="mt-[22px] flex flex-col gap-[14px] rounded-[14px] border border-[#ff4b00]/25 bg-[#ff4b00]/[0.06] p-[20px] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-[12px]">
            <CalendarClock size={20} className="text-[#ff4b00]" />
            <div>
              <p className="text-[14px] font-[700] text-white">{t("overview.meetingCardTitle")}</p>
              <p className="text-[13px] text-white/55">{t("overview.meetingCardDesc")}</p>
            </div>
          </div>
          {/* The room link comes from the server (staff only), never the bundle. */}
          <div className="flex flex-col items-end gap-[4px]">
            <button
              type="button"
              onClick={async () => {
                const r = await openMeetingRoom()
                setRoomError(r.ok ? "" : t("overview.meetingLinkMissing"))
              }}
              className="inline-flex shrink-0 items-center justify-center rounded-[10px] bg-[#ff4b00] px-[18px] py-[11px] text-[13px] font-[800] uppercase tracking-[0.02em] text-white hover:brightness-110"
            >
              {t("overview.joinMeeting")}
            </button>
            {roomError && <span className="text-[12px] text-white/45">{roomError}</span>}
          </div>
        </div>
      )}

      <div className="mt-[22px] grid gap-[14px] sm:grid-cols-2">
        {canSeeOrders && (
        <Link
          href={`${base}/ordreoversikt`}
          className="rounded-[14px] border border-white/[0.08] bg-[#111212] p-[20px] transition hover:border-white/20"
        >
          <p className="text-[14px] font-[700] text-white">{t("overview.viewOrdersTitle")}</p>
          <p className="mt-[4px] text-[13px] text-white/50">{t("overview.viewOrdersDesc")}</p>
        </Link>
        )}
        {can("messages.view") && (
        <Link
          href={`${base}/meldinger`}
          className="relative rounded-[14px] border border-white/[0.08] bg-[#111212] p-[20px] transition hover:border-white/20"
        >
          <span className="flex items-center gap-[8px]">
            <p className="text-[14px] font-[700] text-white">{t("overview.openMessagesTitle")}</p>
            <UnreadBadge count={unreadMessages} />
          </span>
          <p className="mt-[4px] text-[13px] text-white/50">{t("overview.openMessagesDesc")}</p>
        </Link>
        )}
      </div>
      <PinnedNotesCard />
    </div>
  )
}