"use client"

import { useCallback, useEffect, useState } from "react"
import { Ban, Check, EyeOff, ExternalLink, Search, Trash2 } from "lucide-react"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { Card, Empty, ErrorNote, LoadingBlock, Pager, StatusBadge, fmtDate, iconBtn, inputClass, useDebounced } from "./adminUi"

export default function CommentsModeration() {
  const { t } = useTranslation()
  const [status, setStatus] = useState("")
  const [postId, setPostId] = useState("")
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const [posts, setPosts] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState("")
  const debouncedQ = useDebounced(q)

  // Posts for the "filter by post" dropdown (most recent 50).
  useEffect(() => {
    api
      .get("/blog/admin/posts?limit=50&sort=newest")
      .then((res) => setPosts(res.posts.map((p) => ({ _id: p._id, title: p.title }))))
      .catch((err) => console.error(err))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const sp = new URLSearchParams({ page: String(page), limit: "12" })
      if (status) sp.set("status", status)
      if (postId) sp.set("post", postId)
      if (debouncedQ) sp.set("q", debouncedQ)
      setData(await api.get(`/blog/admin/comments?${sp}`))
    } catch (err) {
      console.error(err)
      setError(t("blogAdmin.loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [page, status, postId, debouncedQ, t])

  useEffect(() => {
    load()
  }, [load])
  useEffect(() => setPage(1), [status, postId, debouncedQ])

  const act = async (id, fn) => {
    setBusyId(id)
    setError("")
    try {
      await fn()
      await load()
    } catch (err) {
      console.error(err)
      setError(t("blogAdmin.actionFailed"))
    } finally {
      setBusyId("")
    }
  }

  const comments = data?.comments || []

  return (
    <div className="space-y-[14px]">
      <div className="flex flex-wrap gap-[10px]">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2 text-white/35" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("blogAdmin.comments.search")} aria-label={t("blogAdmin.comments.search")} className={`${inputClass} !pl-[34px]`} />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t("blogAdmin.editor.status")} className={`${inputClass} !w-auto`}>
          <option value="">{t("blogAdmin.posts.allStatuses")}</option>
          {["approved", "pending", "hidden", "spam"].map((s) => (
            <option key={s} value={s}>
              {t(`blogAdmin.status.${s}`)}
            </option>
          ))}
        </select>
        <select value={postId} onChange={(e) => setPostId(e.target.value)} aria-label={t("blogAdmin.comments.filterPost")} className={`${inputClass} !w-auto max-w-[260px]`}>
          <option value="">{t("blogAdmin.comments.allPosts")}</option>
          {posts.map((p) => (
            <option key={p._id} value={p._id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>

      <ErrorNote onRetry={load}>{error}</ErrorNote>

      {loading && !data ? (
        <LoadingBlock rows={5} />
      ) : comments.length === 0 ? (
        <Empty>{t("blogAdmin.comments.empty")}</Empty>
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <Card className="divide-y divide-white/[0.06]">
            {comments.map((c) => (
              <div key={c._id} className="p-[14px]">
                <div className="flex flex-wrap items-start justify-between gap-[10px]">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-[10px] gap-y-[4px]">
                      <span className="text-[13.5px] font-[700] text-white">{c.userName}</span>
                      <StatusBadge status={c.status} />
                      {c.isReply && <span className="text-[11px] text-white/40">{t("blogAdmin.comments.reply")}</span>}
                      <span className="text-[11.5px] text-white/40">{fmtDate(c.createdAt, true)}</span>
                    </div>
                    <p className="mt-[6px] whitespace-pre-wrap break-words text-[13.5px] leading-[1.6] text-white/80">{c.body}</p>
                    {c.post && (
                      <a href={`/blog/${c.post.slug}#comments`} target="_blank" rel="noopener noreferrer" className="mt-[6px] inline-flex items-center gap-[5px] text-[12px] text-white/45 hover:text-[#ff4b00]">
                        <ExternalLink size={12} />
                        {c.post.title}
                      </a>
                    )}
                  </div>
                  <div className="flex gap-[2px]">
                    {c.status !== "approved" && (
                      <button type="button" className={`${iconBtn} hover:!text-emerald-400`} title={t("blogAdmin.comments.approve")} aria-label={t("blogAdmin.comments.approve")} disabled={busyId === c._id} onClick={() => act(c._id, () => api.patch(`/blog/comments/${c._id}`, { status: "approved" }))}>
                        <Check size={15} />
                      </button>
                    )}
                    {c.status !== "hidden" && (
                      <button type="button" className={iconBtn} title={t("blogAdmin.comments.hide")} aria-label={t("blogAdmin.comments.hide")} disabled={busyId === c._id} onClick={() => act(c._id, () => api.patch(`/blog/comments/${c._id}`, { status: "hidden" }))}>
                        <EyeOff size={15} />
                      </button>
                    )}
                    {c.status !== "spam" && (
                      <button type="button" className={iconBtn} title={t("blogAdmin.comments.spam")} aria-label={t("blogAdmin.comments.spam")} disabled={busyId === c._id} onClick={() => act(c._id, () => api.patch(`/blog/comments/${c._id}`, { status: "spam" }))}>
                        <Ban size={15} />
                      </button>
                    )}
                    <button type="button" className={`${iconBtn} hover:!text-red-400`} title={t("blog.delete")} aria-label={t("blog.delete")} disabled={busyId === c._id} onClick={() => window.confirm(t("blogAdmin.comments.deleteConfirm")) && act(c._id, () => api.delete(`/blog/comments/${c._id}`))}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </Card>
          <Pager page={data.page} pages={data.pages} onPage={setPage} />
        </div>
      )}
    </div>
  )
}
