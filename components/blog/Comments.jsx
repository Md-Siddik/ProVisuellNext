"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertCircle, MessageCircle } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { api } from "@/lib/api"
import { getDisplayName } from "@/lib/displayName"
import { useTranslation } from "@/lib/i18n"
import LoginRequiredModal from "@/components/LoginRequiredModal"
import { Avatar, formatDate } from "./blogUi"
import { CommentsSkeleton } from "./BlogSkeletons"
import { rememberBlogIntent, takeBlogIntent } from "./LikeButton"

const MAX = 1000
const PAGE_SIZE = 10

function CommentForm({ postId, parent = null, placeholder, submitLabel, onDone, onCancel, autoFocus = false, textareaRef }) {
  const { t } = useTranslation()
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const submit = async (e) => {
    e.preventDefault()
    const text = body.trim()
    if (!text || busy) return
    setBusy(true)
    setError("")
    try {
      const { comment } = await api.post(`/blog/posts/${postId}/comments`, { body: text, ...(parent ? { parent } : {}) })
      setBody("")
      onDone(comment)
    } catch (err) {
      console.error(err)
      setError(t("blog.commentFailed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-[10px]">
      <label className="sr-only" htmlFor={`comment-${parent || "new"}`}>
        {placeholder}
      </label>
      <textarea
        id={`comment-${parent || "new"}`}
        ref={textareaRef}
        value={body}
        onChange={(e) => {
          setBody(e.target.value)
          if (error) setError("")
        }}
        rows={parent ? 2 : 3}
        maxLength={MAX}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="w-full resize-y rounded-[12px] border border-white/12 bg-white/[0.04] px-[14px] py-[11px] text-[14px] leading-[1.6] text-white placeholder-white/35 outline-none transition-colors focus:border-[#ff4b00]"
      />
      {error && (
        <p role="alert" className="flex items-center gap-[7px] rounded-[8px] border border-red-500/25 bg-red-500/10 px-[12px] py-[7px] text-[12.5px] text-red-300">
          <AlertCircle size={13} className="shrink-0" />
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-[10px]">
        <span className="text-[11.5px] tabular-nums text-white/35">{t("blog.commentsCounter", { n: body.length, max: MAX })}</span>
        <div className="flex items-center gap-[8px]">
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded-full px-[14px] py-[8px] text-[12.5px] font-[700] text-white/60 transition-colors hover:text-white">
              {t("blog.cancel")}
            </button>
          )}
          <button
            type="submit"
            disabled={busy || !body.trim()}
            className="rounded-full bg-[#ff4b00] px-[18px] py-[9px] text-[12.5px] font-[800] uppercase tracking-[0.02em] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? t("blog.posting") : submitLabel}
          </button>
        </div>
      </div>
    </form>
  )
}

function CommentItem({ comment, postId, canReply, isReply = false, onReplied, onChanged, onDeleted }) {
  const { t } = useTranslation()
  const [replying, setReplying] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.body)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const saveEdit = async () => {
    const text = draft.trim()
    if (!text || busy) return
    setBusy(true)
    setError("")
    try {
      const { comment: updated } = await api.patch(`/blog/comments/${comment._id}`, { body: text })
      onChanged({ ...comment, ...updated })
      setEditing(false)
    } catch (err) {
      console.error(err)
      setError(t("blog.commentFailed"))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(t("blog.deleteConfirm"))) return
    try {
      await api.delete(`/blog/comments/${comment._id}`)
      onDeleted(comment)
    } catch (err) {
      console.error(err)
      setError(t("blog.commentFailed"))
    }
  }

  const action = "text-[12px] font-[700] text-white/45 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-[#ff4b00]"

  return (
    <li className="flex gap-[12px]">
      <Avatar name={comment.userName} src={comment.userAvatar} size={isReply ? 30 : 38} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-[10px] gap-y-[2px]">
          <span className="text-[13.5px] font-[700] text-white">{comment.userName}</span>
          <time dateTime={comment.createdAt} className="text-[11.5px] text-white/40">
            {formatDate(comment.createdAt, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </time>
          {comment.editedAt && <span className="text-[11px] italic text-white/30">{t("blog.edited")}</span>}
          {comment.status === "pending" && (
            <span className="rounded-full border border-amber-400/40 px-[8px] py-[1px] text-[10.5px] font-[700] text-amber-300">{t("blog.awaitingApproval")}</span>
          )}
        </div>

        {editing ? (
          <div className="mt-[8px] space-y-[8px]">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={MAX}
              aria-label={t("blog.edit")}
              className="w-full resize-y rounded-[10px] border border-white/12 bg-white/[0.04] px-[12px] py-[9px] text-[14px] text-white outline-none focus:border-[#ff4b00]"
            />
            <div className="flex gap-[8px]">
              <button type="button" onClick={saveEdit} disabled={busy || !draft.trim()} className="rounded-full bg-[#ff4b00] px-[14px] py-[6px] text-[12px] font-[800] text-white disabled:opacity-40">
                {t("blog.save")}
              </button>
              <button type="button" onClick={() => { setEditing(false); setDraft(comment.body) }} className="px-[10px] text-[12px] font-[700] text-white/60 hover:text-white">
                {t("blog.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-[4px] whitespace-pre-wrap break-words text-[14px] leading-[1.65] text-white/80">{comment.body}</p>
        )}

        {error && <p role="alert" className="mt-[6px] text-[12px] text-red-300">{error}</p>}

        {!editing && (
          <div className="mt-[6px] flex items-center gap-[14px]">
            {canReply && !isReply && (
              <button type="button" onClick={() => setReplying((v) => !v)} className={action}>
                {t("blog.reply")}
              </button>
            )}
            {comment.mine && (
              <>
                <button type="button" onClick={() => setEditing(true)} className={action}>
                  {t("blog.edit")}
                </button>
                <button type="button" onClick={remove} className={action}>
                  {t("blog.delete")}
                </button>
              </>
            )}
          </div>
        )}

        {replying && (
          <div className="mt-[10px]">
            <CommentForm
              postId={postId}
              parent={comment._id}
              autoFocus
              placeholder={t("blog.replyPlaceholder")}
              submitLabel={t("blog.reply")}
              onCancel={() => setReplying(false)}
              onDone={(reply) => {
                setReplying(false)
                onReplied(comment._id, reply)
              }}
            />
          </div>
        )}

        {comment.replies?.length > 0 && (
          <ul className="mt-[14px] space-y-[14px] border-l border-white/[0.08] pl-[14px]">
            {comment.replies.map((r) => (
              <CommentItem
                key={r._id}
                comment={r}
                postId={postId}
                isReply
                canReply={false}
                onReplied={onReplied}
                onChanged={(updated) => onChanged(updated, comment._id)}
                onDeleted={(gone) => onDeleted(gone, comment._id)}
              />
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}

export default function Comments({ postId, initialCount }) {
  const { t } = useTranslation()
  const { isAuthenticated, needsEmailVerification, loading: authLoading, profile, firebaseUser } = useAuth()
  const hasAccount = isAuthenticated && !needsEmailVerification
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(initialCount)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [notice, setNotice] = useState("")
  const [showLogin, setShowLogin] = useState(false)
  const sectionRef = useRef(null)
  const composerRef = useRef(null)

  const load = useCallback(
    async (nextPage, append) => {
      try {
        setLoadError(false)
        const data = await api.get(`/blog/posts/${postId}/comments?page=${nextPage}&limit=${PAGE_SIZE}`)
        setItems((prev) => (append ? [...prev, ...data.comments] : data.comments))
        setTotal(data.total)
        setPage(nextPage)
        setHasMore(data.hasMore)
      } catch (err) {
        console.error(err)
        setLoadError(true)
      }
    },
    [postId]
  )

  // Loads on arrival and again once we know who is signed in (their own
  // pending comments only come back for an authenticated request).
  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    setLoading(true)
    load(1, false).finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [authLoading, hasAccount, load])

  // Returning from the login page after trying to comment: jump to the box.
  useEffect(() => {
    if (authLoading || !hasAccount) return
    if (takeBlogIntent(postId, "comment")) {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      setTimeout(() => composerRef.current?.focus(), 500)
    }
  }, [authLoading, hasAccount, postId])

  const loadMore = async () => {
    setLoadingMore(true)
    await load(page + 1, true)
    setLoadingMore(false)
  }

  const askLogin = () => {
    rememberBlogIntent(postId, "comment")
    setShowLogin(true)
  }

  const handleNew = (comment) => {
    if (comment.status === "pending") setNotice(t("blog.commentAwaiting"))
    else setNotice("")
    setItems((prev) => [{ ...comment, replies: [] }, ...prev])
    setTotal((n) => n + (comment.status === "approved" ? 1 : 0))
  }

  const handleReplied = (parentId, reply) => {
    if (reply.status === "pending") setNotice(t("blog.commentAwaiting"))
    setItems((prev) => prev.map((c) => (c._id === parentId ? { ...c, replies: [...(c.replies || []), reply] } : c)))
    setTotal((n) => n + (reply.status === "approved" ? 1 : 0))
  }

  const handleChanged = (updated, parentId) =>
    setItems((prev) =>
      prev.map((c) => {
        if (parentId ? c._id === parentId : c._id === updated._id) {
          return parentId ? { ...c, replies: c.replies.map((r) => (r._id === updated._id ? { ...r, ...updated } : r)) } : { ...c, ...updated }
        }
        return c
      })
    )

  const handleDeleted = (gone, parentId) => {
    if (parentId) {
      setItems((prev) => prev.map((c) => (c._id === parentId ? { ...c, replies: c.replies.filter((r) => r._id !== gone._id) } : c)))
      setTotal((n) => Math.max(0, n - 1))
    } else {
      setItems((prev) => prev.filter((c) => c._id !== gone._id))
      setTotal((n) => Math.max(0, n - 1 - (gone.replies?.length || 0)))
    }
  }

  return (
    <section ref={sectionRef} id="comments" aria-labelledby="comments-title" className="scroll-mt-[100px]">
      <h2 id="comments-title" className="flex items-center gap-[10px] text-[22px] font-[800] tracking-[-0.02em] text-white">
        <MessageCircle size={22} className="text-[#ff4b00]" aria-hidden="true" />
        {t("blog.commentsTitle", { n: total })}
      </h2>

      <div className="mt-[20px]">
        {hasAccount ? (
          <div className="flex gap-[12px]">
            <Avatar name={getDisplayName(profile, firebaseUser)} src={firebaseUser?.photoURL} size={38} />
            <div className="min-w-0 flex-1">
              <CommentForm postId={postId} placeholder={t("blog.commentPlaceholder")} submitLabel={t("blog.postComment")} onDone={handleNew} textareaRef={composerRef} />
              {notice && (
                <p role="status" className="mt-[10px] rounded-[8px] border border-amber-400/30 bg-amber-400/10 px-[12px] py-[8px] text-[12.5px] text-amber-200">
                  {notice}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start justify-between gap-[14px] rounded-[14px] border border-white/10 bg-white/[0.03] p-[18px] sm:flex-row sm:items-center">
            <p className="text-[14px] text-white/65">{t("blog.signInToComment")}</p>
            <button
              type="button"
              onClick={askLogin}
              className="rounded-full bg-[#ff4b00] px-[20px] py-[10px] text-[12.5px] font-[800] uppercase tracking-[0.02em] text-white transition hover:brightness-110"
            >
              {t("blog.loginToCommentButton")}
            </button>
          </div>
        )}
      </div>

      <div className="mt-[28px]" aria-live="polite">
        {loading ? (
          <CommentsSkeleton />
        ) : loadError && items.length === 0 ? (
          <div className="flex items-center justify-between gap-[12px] rounded-[12px] border border-red-500/25 bg-red-500/10 px-[14px] py-[12px] text-[13px] text-red-200">
            <span>{t("blog.commentsLoadFailed")}</span>
            <button type="button" onClick={() => load(1, false)} className="rounded-full border border-red-300/40 px-[12px] py-[4px] text-[12px] font-[700] hover:bg-red-500/15">
              {t("blog.retry")}
            </button>
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-[12px] border border-dashed border-white/12 px-[16px] py-[24px] text-center text-[13.5px] text-white/45">{t("blog.noComments")}</p>
        ) : (
          <>
            <ul className="space-y-[22px]">
              {items.map((c) => (
                <CommentItem key={c._id} comment={c} postId={postId} canReply={hasAccount} onReplied={handleReplied} onChanged={handleChanged} onDeleted={handleDeleted} />
              ))}
            </ul>
            {hasMore && (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="mt-[24px] w-full rounded-full border border-white/15 py-[11px] text-[13px] font-[700] text-white/80 transition-colors hover:border-white/35 hover:text-white disabled:opacity-50 sm:w-auto sm:px-[28px]"
              >
                {loadingMore ? t("blog.posting") : t("blog.loadMoreComments")}
              </button>
            )}
          </>
        )}
      </div>

      {showLogin && (
        <LoginRequiredModal
          title={t("blog.loginRequiredTitle")}
          message={t("blog.loginToComment")}
          from={typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined}
          onClose={() => setShowLogin(false)}
        />
      )}
    </section>
  )
}
