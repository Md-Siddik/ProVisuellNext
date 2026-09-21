"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Heart } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import LoginRequiredModal from "@/components/LoginRequiredModal"
import { useBlogToast } from "./useBlogToast"

export const BLOG_INTENT_KEY = "pv_blog_intent"

export function rememberBlogIntent(postId, action) {
  try {
    sessionStorage.setItem(BLOG_INTENT_KEY, JSON.stringify({ postId, action }))
  } catch {
    // storage unavailable — the visitor just has to repeat the action after logging in
  }
}

// Consumes the remembered intent only if it is this post and this action,
// so the like button and the comment box never steal each other's intent.
export function takeBlogIntent(postId, wanted) {
  try {
    const raw = sessionStorage.getItem(BLOG_INTENT_KEY)
    if (!raw) return false
    const intent = JSON.parse(raw)
    if (intent?.postId !== postId || intent?.action !== wanted) return false
    sessionStorage.removeItem(BLOG_INTENT_KEY)
    return true
  } catch {
    return false
  }
}

// Liking needs a signed-in account (also enforced by the API). Logged-out
// visitors get the site's existing login prompt, and a like they meant to
// make is applied automatically when they come back signed in.
export default function LikeButton({ postId, initialCount }) {
  const { t } = useTranslation()
  const { isAuthenticated, needsEmailVerification, loading } = useAuth()
  const hasAccount = isAuthenticated && !needsEmailVerification
  const [liked, setLiked] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [busy, setBusy] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [toast, showToast] = useBlogToast()
  const busyRef = useRef(false)

  const send = useCallback(
    async (next) => {
      if (busyRef.current) return
      busyRef.current = true
      setBusy(true)
      // Optimistic: reflect the click immediately, roll back if the server says no.
      setLiked(next)
      setCount((c) => Math.max(0, c + (next ? 1 : -1)))
      try {
        const res = next ? await api.post(`/blog/posts/${postId}/like`) : await api.delete(`/blog/posts/${postId}/like`)
        setLiked(res.liked)
        setCount(res.likeCount)
      } catch (err) {
        console.error(err)
        setLiked(!next)
        setCount((c) => Math.max(0, c + (next ? -1 : 1)))
        showToast(next ? t("blog.likeFailed") : t("blog.unlikeFailed"), "error")
      } finally {
        busyRef.current = false
        setBusy(false)
      }
    },
    [postId, showToast, t]
  )

  // Once we know who the visitor is: load their like state, and finish a like
  // they started before being sent to log in.
  useEffect(() => {
    if (loading) return
    if (!hasAccount) {
      setLiked(false)
      return
    }
    let cancelled = false
    api
      .get(`/blog/posts/${postId}/like`)
      .then((res) => {
        if (cancelled) return
        setLiked(res.liked)
        setCount(res.likeCount)
        if (takeBlogIntent(postId, "like") && !res.liked) send(true)
      })
      .catch((err) => console.error(err))
    return () => {
      cancelled = true
    }
  }, [hasAccount, loading, postId, send])

  const onClick = () => {
    if (!hasAccount) {
      rememberBlogIntent(postId, "like")
      setShowLogin(true)
      return
    }
    send(!liked)
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-pressed={liked}
        aria-label={liked ? t("blog.unlike") : t("blog.like")}
        className={`inline-flex h-[40px] items-center gap-[8px] rounded-full border px-[16px] text-[13px] font-[700] transition-all duration-200 focus-visible:outline-2 focus-visible:outline-[#ff4b00] disabled:cursor-wait ${
          liked ? "border-[#ff4b00] bg-[#ff4b00]/12 text-[#ff4b00]" : "border-white/15 text-white/85 hover:border-white/35 hover:text-white"
        }`}
      >
        <Heart size={16} fill={liked ? "currentColor" : "none"} className={liked ? "scale-110 transition-transform" : "transition-transform"} />
        <span>{liked ? t("blog.liked") : t("blog.like")}</span>
        <span className="min-w-[1ch] tabular-nums text-white/60" aria-label={t("blog.likeCountLabel", { n: count })}>
          {count}
        </span>
      </button>
      {showLogin && (
        <LoginRequiredModal
          title={t("blog.loginRequiredTitle")}
          message={t("blog.loginToLike")}
          from={typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined}
          onClose={() => setShowLogin(false)}
        />
      )}
      {toast}
    </>
  )
}
