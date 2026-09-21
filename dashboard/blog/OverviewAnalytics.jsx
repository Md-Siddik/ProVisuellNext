"use client"

import { useCallback, useEffect, useState } from "react"
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { CalendarClock, FileEdit, FileText, Globe, Heart, MessageCircle, MessageSquareWarning, Plus } from "lucide-react"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { getLocale } from "@/lib/i18n/locale"
import { Card, Empty, ErrorNote, LoadingBlock, StatusBadge, btnPrimary, fmtDate } from "./adminUi"

function useOverview() {
  const { t } = useTranslation()
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  const load = useCallback(async () => {
    setError("")
    try {
      setData(await api.get("/blog/admin/overview"))
    } catch (err) {
      console.error(err)
      setError(t("blogAdmin.loadFailed"))
    }
  }, [t])
  useEffect(() => {
    load()
  }, [load])
  return { data, error, load }
}

function Stat({ icon: Icon, label, value, accent }) {
  return (
    <Card className="p-[16px]">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-[600] text-white/50">{label}</span>
        <span className={`flex h-[30px] w-[30px] items-center justify-center rounded-full ${accent ? "bg-[#ff4b00]/15 text-[#ff4b00]" : "bg-white/[0.06] text-white/60"}`}>
          <Icon size={15} />
        </span>
      </div>
      <p className="mt-[8px] text-[28px] font-[800] tabular-nums tracking-[-0.02em] text-white">{value}</p>
    </Card>
  )
}

export function Overview({ onCreate, onEdit, onOpen }) {
  const { t } = useTranslation()
  const { data, error, load } = useOverview()
  if (error) return <ErrorNote onRetry={load}>{error}</ErrorNote>
  if (!data) return <LoadingBlock rows={4} />
  const { totals } = data

  return (
    <div className="space-y-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-[10px]">
        <p className="text-[13.5px] text-white/55">{t("blogAdmin.overview.intro")}</p>
        <button type="button" onClick={onCreate} className={btnPrimary}>
          <Plus size={15} />
          {t("blogAdmin.createPost")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-[12px] md:grid-cols-4">
        <Stat icon={FileText} label={t("blogAdmin.overview.total")} value={totals.posts} accent />
        <Stat icon={Globe} label={t("blogAdmin.overview.published")} value={totals.published} />
        <Stat icon={FileEdit} label={t("blogAdmin.overview.drafts")} value={totals.draft} />
        <Stat icon={CalendarClock} label={t("blogAdmin.overview.scheduled")} value={totals.scheduled} />
        <Stat icon={MessageCircle} label={t("blogAdmin.overview.comments")} value={totals.comments} />
        <Stat icon={MessageSquareWarning} label={t("blogAdmin.overview.pending")} value={totals.pendingComments} accent={totals.pendingComments > 0} />
        <Stat icon={Heart} label={t("blogAdmin.overview.likes")} value={totals.likes} />
      </div>

      <div className="grid gap-[14px] lg:grid-cols-2">
        <Card className="p-[16px]">
          <div className="mb-[10px] flex items-center justify-between">
            <h3 className="text-[14px] font-[800] text-white">{t("blogAdmin.overview.recentPosts")}</h3>
            <button type="button" onClick={() => onOpen("posts")} className="text-[12px] font-[700] text-[#ff4b00] hover:underline">{t("blogAdmin.overview.viewAll")}</button>
          </div>
          {data.recentPosts.length === 0 ? (
            <Empty>{t("blogAdmin.posts.empty")}</Empty>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {data.recentPosts.map((p) => (
                <li key={p._id} className="flex items-center justify-between gap-[10px] py-[9px]">
                  <button type="button" onClick={() => onEdit(p._id)} className="min-w-0 truncate text-left text-[13.5px] font-[600] text-white hover:text-[#ff4b00]">{p.title}</button>
                  <div className="flex shrink-0 items-center gap-[10px]">
                    <StatusBadge status={p.status} />
                    <span className="hidden text-[11.5px] text-white/35 sm:inline">{fmtDate(p.updatedAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-[16px]">
          <div className="mb-[10px] flex items-center justify-between">
            <h3 className="text-[14px] font-[800] text-white">{t("blogAdmin.overview.recentComments")}</h3>
            <button type="button" onClick={() => onOpen("comments")} className="text-[12px] font-[700] text-[#ff4b00] hover:underline">{t("blogAdmin.overview.viewAll")}</button>
          </div>
          {data.recentComments.length === 0 ? (
            <Empty>{t("blogAdmin.comments.empty")}</Empty>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {data.recentComments.map((c) => (
                <li key={c._id} className="py-[9px]">
                  <div className="flex items-center justify-between gap-[8px]">
                    <span className="truncate text-[13px] font-[700] text-white">{c.userName}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="mt-[3px] line-clamp-2 text-[12.5px] leading-[1.5] text-white/60">{c.body}</p>
                  <p className="mt-[2px] truncate text-[11px] text-white/35">{c.postTitle}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function TopList({ title, items, icon: Icon }) {
  const { t } = useTranslation()
  return (
    <Card className="p-[16px]">
      <h3 className="mb-[10px] text-[14px] font-[800] text-white">{title}</h3>
      {items.length === 0 ? (
        <Empty>{t("blogAdmin.analytics.noData")}</Empty>
      ) : (
        <ol className="space-y-[8px]">
          {items.map((p, i) => (
            <li key={p._id} className="flex items-center gap-[10px] text-[13px]">
              <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-[11px] font-[700] text-white/60">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-white/85">{p.title}</span>
              <span className="inline-flex shrink-0 items-center gap-[5px] font-[700] tabular-nums text-white/70">
                <Icon size={13} className="text-[#ff4b00]" />
                {p.count}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

const tooltipStyle = { background: "#141515", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "#fff", fontSize: 12 }

export function Analytics() {
  const { t } = useTranslation()
  const { data, error, load } = useOverview()
  if (error) return <ErrorNote onRetry={load}>{error}</ErrorNote>
  if (!data) return <LoadingBlock rows={4} />
  const { totals } = data

  const monthLabel = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString(getLocale(), { month: "short" })
  const dayLabel = (d) => new Date(`${d}T00:00:00`).toLocaleDateString(getLocale(), { day: "numeric", month: "short" })
  const hasEngagement = data.engagement.some((d) => d.likes || d.comments)
  const hasPublished = data.publishedOverTime.some((m) => m.posts)

  return (
    <div className="space-y-[16px]">
      <div className="grid grid-cols-2 gap-[12px] md:grid-cols-4">
        <Stat icon={FileText} label={t("blogAdmin.overview.total")} value={totals.posts} accent />
        <Stat icon={Globe} label={t("blogAdmin.overview.published")} value={totals.published} />
        <Stat icon={Heart} label={t("blogAdmin.overview.likes")} value={totals.likes} />
        <Stat icon={MessageCircle} label={t("blogAdmin.overview.comments")} value={totals.comments} />
      </div>

      <div className="grid gap-[14px] lg:grid-cols-2">
        <Card className="p-[16px]">
          <h3 className="mb-[12px] text-[14px] font-[800] text-white">{t("blogAdmin.analytics.publishedOverTime")}</h3>
          {hasPublished ? (
            <div className="h-[230px]" role="img" aria-label={t("blogAdmin.analytics.publishedOverTime")}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.publishedOverTime} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.05)" }} labelFormatter={monthLabel} formatter={(v) => [v, t("blogAdmin.analytics.posts")]} />
                  <Bar dataKey="posts" fill="#ff4b00" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty>{t("blogAdmin.analytics.noData")}</Empty>
          )}
        </Card>

        <Card className="p-[16px]">
          <div className="mb-[12px] flex items-center justify-between gap-[10px]">
            <h3 className="text-[14px] font-[800] text-white">{t("blogAdmin.analytics.engagement")}</h3>
            <span className="flex items-center gap-[12px] text-[11.5px] text-white/55">
              <span className="inline-flex items-center gap-[5px]"><span className="h-[3px] w-[14px] rounded bg-[#ff4b00]" />{t("blogAdmin.overview.likes")}</span>
              <span className="inline-flex items-center gap-[5px]"><span className="h-[3px] w-[14px] rounded bg-sky-400" />{t("blogAdmin.overview.comments")}</span>
            </span>
          </div>
          {hasEngagement ? (
            <div className="h-[230px]" role="img" aria-label={t("blogAdmin.analytics.engagement")}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.engagement} margin={{ top: 4, right: 8, bottom: 0, left: -22 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={dayLabel} tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis allowDecimals={false} tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={dayLabel} />
                  <Line type="monotone" dataKey="likes" name={t("blogAdmin.overview.likes")} stroke="#ff4b00" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="comments" name={t("blogAdmin.overview.comments")} stroke="#38bdf8" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty>{t("blogAdmin.analytics.noData")}</Empty>
          )}
        </Card>
      </div>

      <div className="grid gap-[14px] lg:grid-cols-2">
        <TopList title={t("blogAdmin.analytics.mostLiked")} items={data.mostLiked} icon={Heart} />
        <TopList title={t("blogAdmin.analytics.mostCommented")} items={data.mostCommented} icon={MessageCircle} />
      </div>
    </div>
  )
}
