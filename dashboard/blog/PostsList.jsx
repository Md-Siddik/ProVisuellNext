"use client"

import { useCallback, useEffect, useState } from "react"
import { CopyPlus, ExternalLink, Heart, ImageOff, MessageCircle, Pencil, Search, Star, Trash2, Undo2, Send, Plus } from "lucide-react"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { Card, Empty, ErrorNote, LoadingBlock, Pager, StatusBadge, btnPrimary, fmtDate, iconBtn, inputClass, useDebounced } from "./adminUi"

const PAGE_SIZE = 10

function Thumb({ post }) {
  return post.coverImage ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={post.coverImage} alt="" className="h-[44px] w-[64px] shrink-0 rounded-[8px] object-cover" />
  ) : (
    <span className="flex h-[44px] w-[64px] shrink-0 items-center justify-center rounded-[8px] bg-white/[0.06] text-white/25">
      <ImageOff size={16} aria-hidden="true" />
    </span>
  )
}

export default function PostsList({ preset, taxonomy, onEdit, onCreate }) {
  const { t } = useTranslation()
  const [q, setQ] = useState("")
  const [status, setStatus] = useState(preset === "all" ? "" : preset)
  const [category, setCategory] = useState("")
  const [sort, setSort] = useState("newest")
  const [featuredOnly, setFeaturedOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState("")
  const debouncedQ = useDebounced(q)

  // Switching between All / Drafts / Published resets the filters.
  useEffect(() => {
    setStatus(preset === "all" ? "" : preset)
    setPage(1)
  }, [preset])

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const sp = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sort })
      if (status) sp.set("status", status)
      if (category) sp.set("category", category)
      if (debouncedQ) sp.set("q", debouncedQ)
      if (featuredOnly) sp.set("featured", "1")
      setData(await api.get(`/blog/admin/posts?${sp}`))
    } catch (err) {
      console.error(err)
      setError(t("blogAdmin.loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [page, sort, status, category, debouncedQ, featuredOnly, t])

  useEffect(() => {
    load()
  }, [load])

  // Filters changing always go back to the first page.
  useEffect(() => setPage(1), [debouncedQ, status, category, sort, featuredOnly])

  const act = async (post, fn) => {
    setBusyId(post._id)
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

  const toggleFeatured = (p) => act(p, () => api.patch(`/blog/posts/${p._id}`, { featured: !p.featured }))
  const setPostStatus = (p, next) => act(p, () => api.patch(`/blog/posts/${p._id}`, { status: next }))
  const remove = (p) => {
    if (!window.confirm(t("blogAdmin.posts.deleteConfirm", { title: p.title }))) return
    act(p, () => api.delete(`/blog/posts/${p._id}`))
  }
  const duplicate = (p) =>
    act(p, async () => {
      const { post } = await api.get(`/blog/admin/posts/${p._id}`)
      await api.post("/blog/posts", {
        title: `${post.title} (${t("blogAdmin.posts.copy")})`,
        excerpt: post.excerpt,
        content: post.content,
        coverImage: post.coverImage,
        coverImageAlt: post.coverImageAlt,
        featuredVideo: post.featuredVideo,
        category: post.category || null,
        tags: post.tags,
        status: "draft",
        featured: false,
        seoTitle: post.seoTitle,
        seoDescription: post.seoDescription,
      })
    })

  const posts = data?.posts || []
  const liveStatus = (p) => p.status === "published"

  const actionButtons = (p) => (
    <div className="flex items-center gap-[2px]">
      <button type="button" className={iconBtn} title={t("blogAdmin.posts.edit")} aria-label={t("blogAdmin.posts.edit")} onClick={() => onEdit(p._id)}>
        <Pencil size={15} />
      </button>
      <button
        type="button"
        className={`${iconBtn} ${p.featured ? "!text-[#ff4b00]" : ""}`}
        title={p.featured ? t("blogAdmin.posts.unfeature") : t("blogAdmin.posts.feature")}
        aria-label={p.featured ? t("blogAdmin.posts.unfeature") : t("blogAdmin.posts.feature")}
        aria-pressed={p.featured}
        disabled={busyId === p._id}
        onClick={() => toggleFeatured(p)}
      >
        <Star size={15} fill={p.featured ? "currentColor" : "none"} />
      </button>
      {liveStatus(p) ? (
        <button type="button" className={iconBtn} title={t("blogAdmin.posts.unpublish")} aria-label={t("blogAdmin.posts.unpublish")} disabled={busyId === p._id} onClick={() => setPostStatus(p, "draft")}>
          <Undo2 size={15} />
        </button>
      ) : (
        <button type="button" className={iconBtn} title={t("blogAdmin.posts.publish")} aria-label={t("blogAdmin.posts.publish")} disabled={busyId === p._id} onClick={() => setPostStatus(p, "published")}>
          <Send size={15} />
        </button>
      )}
      {liveStatus(p) && (
        <a className={iconBtn} href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer" title={t("blogAdmin.posts.view")} aria-label={t("blogAdmin.posts.view")}>
          <ExternalLink size={15} />
        </a>
      )}
      <button type="button" className={iconBtn} title={t("blogAdmin.posts.duplicate")} aria-label={t("blogAdmin.posts.duplicate")} disabled={busyId === p._id} onClick={() => duplicate(p)}>
        <CopyPlus size={15} />
      </button>
      <button type="button" className={`${iconBtn} hover:!text-red-400`} title={t("blogAdmin.posts.delete")} aria-label={t("blogAdmin.posts.delete")} disabled={busyId === p._id} onClick={() => remove(p)}>
        <Trash2 size={15} />
      </button>
    </div>
  )

  return (
    <div className="space-y-[14px]">
      <div className="flex flex-wrap items-end gap-[10px]">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2 text-white/35" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("blogAdmin.posts.search")} aria-label={t("blogAdmin.posts.search")} className={`${inputClass} !pl-[34px]`} />
        </div>
        {preset === "all" && (
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t("blogAdmin.editor.status")} className={`${inputClass} !w-auto`}>
            <option value="">{t("blogAdmin.posts.allStatuses")}</option>
            {["draft", "published", "scheduled", "archived"].map((s) => (
              <option key={s} value={s}>
                {t(`blogAdmin.status.${s}`)}
              </option>
            ))}
          </select>
        )}
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t("blogAdmin.editor.category")} className={`${inputClass} !w-auto`}>
          <option value="">{t("blogAdmin.posts.allCategories")}</option>
          {taxonomy.categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t("blogAdmin.posts.sort")} className={`${inputClass} !w-auto`}>
          {["newest", "oldest", "updated", "published", "likes", "comments", "title"].map((s) => (
            <option key={s} value={s}>
              {t(`blogAdmin.posts.sorts.${s}`)}
            </option>
          ))}
        </select>
        <label className="flex h-[40px] cursor-pointer items-center gap-[7px] text-[13px] text-white/75">
          <input type="checkbox" checked={featuredOnly} onChange={(e) => setFeaturedOnly(e.target.checked)} className="h-[15px] w-[15px] accent-[#ff4b00]" />
          {t("blogAdmin.posts.featuredOnly")}
        </label>
      </div>

      <ErrorNote onRetry={load}>{error}</ErrorNote>

      {loading && !data ? (
        <LoadingBlock rows={5} />
      ) : posts.length === 0 ? (
        <Card className="p-[20px]">
          <Empty>{t("blogAdmin.posts.empty")}</Empty>
          <div className="mt-[14px] flex justify-center">
            <button type="button" onClick={onCreate} className={btnPrimary}>
              <Plus size={15} />
              {t("blogAdmin.createPost")}
            </button>
          </div>
        </Card>
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loading}>
          {/* Wide screens: a table. */}
          <Card className="hidden overflow-hidden lg:block">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-white/[0.08] text-[11px] uppercase tracking-[0.05em] text-white/40">
                <tr>
                  <th className="px-[14px] py-[10px] font-[700]">{t("blogAdmin.posts.colPost")}</th>
                  <th className="px-[8px] py-[10px] font-[700]">{t("blogAdmin.posts.colCategory")}</th>
                  <th className="px-[8px] py-[10px] font-[700]">{t("blogAdmin.editor.status")}</th>
                  <th className="px-[8px] py-[10px] font-[700]" title={t("blogAdmin.posts.colLikes")}><Heart size={13} aria-label={t("blogAdmin.posts.colLikes")} /></th>
                  <th className="px-[8px] py-[10px] font-[700]" title={t("blogAdmin.posts.colComments")}><MessageCircle size={13} aria-label={t("blogAdmin.posts.colComments")} /></th>
                  <th className="px-[8px] py-[10px] font-[700]">{t("blogAdmin.posts.colDates")}</th>
                  <th className="px-[8px] py-[10px] font-[700]"><span className="sr-only">{t("blogAdmin.posts.colActions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p._id} className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.02]">
                    <td className="px-[14px] py-[10px]">
                      <div className="flex items-center gap-[12px]">
                        <Thumb post={p} />
                        <div className="min-w-0">
                          <button type="button" onClick={() => onEdit(p._id)} className="block max-w-[300px] truncate text-left text-[13.5px] font-[700] text-white hover:text-[#ff4b00]">
                            {p.featured && <Star size={12} className="mr-[5px] inline text-[#ff4b00]" fill="currentColor" aria-label={t("blogAdmin.editor.featured")} />}
                            {p.title}
                          </button>
                          <p className="truncate text-[11.5px] text-white/40">{p.author.name} · /{p.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-[8px] py-[10px] text-white/65">{p.category?.name || "—"}</td>
                    <td className="px-[8px] py-[10px]"><StatusBadge status={p.status} /></td>
                    <td className="px-[8px] py-[10px] tabular-nums text-white/65">{p.likeCount}</td>
                    <td className="px-[8px] py-[10px] tabular-nums text-white/65">{p.commentCount}</td>
                    <td className="px-[8px] py-[10px] text-[12px] text-white/50">
                      <div>{p.status === "scheduled" ? fmtDate(p.scheduledAt, true) : fmtDate(p.publishedAt)}</div>
                      <div className="text-white/30">{fmtDate(p.updatedAt)}</div>
                    </td>
                    <td className="px-[8px] py-[10px]">{actionButtons(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Narrow screens: cards instead of a wide table. */}
          <ul className="space-y-[10px] lg:hidden">
            {posts.map((p) => (
              <li key={p._id}>
                <Card className="p-[12px]">
                  <div className="flex gap-[12px]">
                    <Thumb post={p} />
                    <div className="min-w-0 flex-1">
                      <button type="button" onClick={() => onEdit(p._id)} className="block w-full text-left text-[14px] font-[700] leading-[1.3] text-white">
                        {p.title}
                      </button>
                      <p className="mt-[3px] truncate text-[11.5px] text-white/40">{p.author.name} · {p.category?.name || "—"}</p>
                    </div>
                  </div>
                  <div className="mt-[10px] flex flex-wrap items-center gap-x-[12px] gap-y-[6px] text-[12px] text-white/55">
                    <StatusBadge status={p.status} />
                    <span className="inline-flex items-center gap-[4px]"><Heart size={12} />{p.likeCount}</span>
                    <span className="inline-flex items-center gap-[4px]"><MessageCircle size={12} />{p.commentCount}</span>
                    <span>{p.status === "scheduled" ? fmtDate(p.scheduledAt, true) : fmtDate(p.publishedAt)}</span>
                  </div>
                  <div className="mt-[8px] border-t border-white/[0.06] pt-[8px]">{actionButtons(p)}</div>
                </Card>
              </li>
            ))}
          </ul>

          <Pager page={data.page} pages={data.pages} onPage={setPage} />
        </div>
      )}
    </div>
  )
}
