"use client"

import { useEffect, useRef, useState } from "react"
import { getLocale } from "@/lib/i18n/locale"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { AlertCircle, CalendarClock, Mail, MessageSquare, Send, ShoppingBag, X } from "lucide-react"
import { chatStorage } from "@/lib/chatStorage"
import { useAuth } from "@/context/AuthContext"
import { api } from "@/lib/api"
import { getDisplayName } from "@/lib/displayName"
import BookMeetingModal from "./BookMeetingModal"
import EmailComposeModal from "./EmailComposeModal"
import LoginRequiredModal from "./LoginRequiredModal"
import UnreadBadge from "./UnreadBadge"
import { useUnreadMessages } from "@/hooks/useUnreadMessages"
import { OPEN_CHAT_EVENT } from "./StartOrderModal"
import { useTranslation } from "@/lib/i18n"

function formatTime(iso) {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" })
  } catch {
    return ""
  }
}

function normalizeServerMessage(m) {
  return { id: m._id, sender: m.sender, text: m.text, time: m.time }
}

const TYPING_STALE_MS = 5000
const TYPING_PING_INTERVAL_MS = 2500

function isRecent(dateStr) {
  return Boolean(dateStr) && Date.now() - new Date(dateStr).getTime() < TYPING_STALE_MS
}

function TypingBubble() {
  return (
    <div data-testid="typing-bubble" className="flex items-start">
      <div className="flex items-center gap-[4px] rounded-[14px] rounded-bl-[4px] border border-white/10 bg-white/[0.06] px-[14px] py-[11px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-[6px] w-[6px] animate-bounce rounded-full bg-white/50"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  )
}

const ChatWidget = () => {
  const { t } = useTranslation()
  const { isAuthenticated, needsEmailVerification, profile, role, firebaseUser } = useAuth()
  // A password account still waiting on email confirmation has a Firebase
  // session but no application access yet — treat it like an anonymous
  // visitor here so it doesn't fire authenticated fetches ahead of that.
  const hasAccount = isAuthenticated && !needsEmailVerification
  const router = useRouter()
  // The marketing homepage has its own mobile bottom action bar with a
  // Message button that opens this same widget — hide this floating bubble
  // there on mobile so the two don't stack on top of each other. Every
  // other page still relies on this as its only mobile chat entry point.
  const isHome = usePathname() === "/"
  // Owner/administrator don't have a "conversation with support" of their
  // own — this same bottom-right bubble instead becomes their shortcut to
  // the real customer inbox, badge included, so there's one message icon
  // in the corner rather than a second one bolted on elsewhere.
  const isStaff = role === "owner" || role === "administrator"
  const staffUnreadCount = useUnreadMessages()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [showBooking, setShowBooking] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [showLoginRequired, setShowLoginRequired] = useState(false)
  const [adminTypingAt, setAdminTypingAt] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [sendError, setSendError] = useState("")
  const listRef = useRef(null)
  const textareaRef = useRef(null)
  const lastTypingPingRef = useRef(0)
  // Every fetch that can overwrite `messages` (initial load, the live
  // poll, and sending) grabs a ticket before awaiting and only applies its
  // result if no newer request has started since — otherwise a slow poll
  // response landing after a send could overwrite the message you just
  // typed with stale server data, making it look like a completely
  // different message was sent.
  const requestSeqRef = useRef(0)
  // A "last request wins" rule alone gets one case backwards: if the poll's
  // GET reads the conversation before the send's POST has actually
  // committed, the poll "wins" (it started later) and wipes the optimistic
  // message — and then the send's own, correct response gets discarded for
  // being "older", even though the message really was saved. This ref
  // makes the poll skip itself entirely while a send is in flight, so the
  // send's own response is always what determines the final state.
  const sendingRef = useRef(false)

  // Anonymous visitors: local, permanent thread. Logged-in customers: the
  // real backend thread, which the admin inbox (Meldinger.jsx) reads too.
  // Staff never has one of their own — skip entirely.
  useEffect(() => {
    if (isStaff) return
    let cancelled = false
    async function load() {
      if (hasAccount) {
        const seq = ++requestSeqRef.current
        try {
          const { conversation } = await api.get("/messages/mine")
          if (!cancelled && seq === requestSeqRef.current) setMessages(conversation.messages.map(normalizeServerMessage))
        } catch (err) {
          console.error("Failed to load conversation:", err.message)
        }
      } else {
        chatStorage.getVisitorId()
        const stored = chatStorage.loadMessages()
        if (stored.length === 0) {
          const seeded = [{ id: "welcome", sender: "system", text: t("chatWidget.welcomeMessage"), time: new Date().toISOString() }]
          setMessages(seeded)
          chatStorage.saveMessages(seeded)
        } else {
          setMessages(stored)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [hasAccount, isStaff])

  // Light polling so a logged-in customer sees admin replies — and the
  // admin's live typing status — without needing to close/reopen the widget.
  useEffect(() => {
    if (!open || !hasAccount || isStaff) return
    const interval = setInterval(async () => {
      if (sendingRef.current) return // a send is in flight — let it settle first
      const seq = ++requestSeqRef.current
      try {
        const { conversation } = await api.get("/messages/mine")
        if (sendingRef.current || seq !== requestSeqRef.current) return
        setMessages(conversation.messages.map(normalizeServerMessage))
        setAdminTypingAt(conversation.typing?.admin || null)
      } catch (err) {
        console.error("Failed to refresh conversation:", err.message)
      }
    }, TYPING_PING_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [open, hasAccount, isStaff])

  // While closed, check for an unread admin reply so the toggle button can
  // show a badge — opening the widget fetches /messages/mine, which clears
  // it server-side, so this only needs to run when closed.
  useEffect(() => {
    if (open || !hasAccount || isStaff) {
      if (open) setUnreadCount(0)
      return
    }
    let cancelled = false
    const check = async () => {
      try {
        const { count } = await api.get("/messages/mine/unread")
        if (!cancelled) setUnreadCount(count || 0)
      } catch {
        // ignore — badge just won't update this tick
      }
    }
    check()
    const interval = setInterval(check, 20000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [open, hasAccount, isStaff])

  useEffect(() => {
    if (!listRef.current) return
    listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, open, adminTypingAt])

  // Lets other entry points (the header's "Start prosjekt" button, the
  // StartOrderModal's "Chat med oss" option) open this widget from
  // anywhere without prop-drilling.
  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener(OPEN_CHAT_EVENT, handler)
    return () => window.removeEventListener(OPEN_CHAT_EVENT, handler)
  }, [])

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => textareaRef.current?.focus(), 250)
      return () => clearTimeout(t)
    }
  }, [open])

  const appendLocalMessage = (partial) => {
    setMessages((prev) => {
      const next = [
        ...prev,
        { id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, time: new Date().toISOString(), ...partial },
      ]
      chatStorage.saveMessages(next)
      return next
    })
  }

  const sendAuthenticated = async (text) => {
    setSending(true)
    setSendError("")
    const optimisticId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const optimistic = { id: optimisticId, sender: "user", text, time: new Date().toISOString() }
    setMessages((prev) => [...prev, optimistic])
    ++requestSeqRef.current
    sendingRef.current = true
    try {
      const { conversation } = await api.post("/messages/mine", { text })
      // The send's own response is always authoritative for what it just
      // sent — never gated behind the seq check (that's only for the poll).
      setMessages(conversation.messages.map(normalizeServerMessage))
    } catch (err) {
      console.error("Failed to send message:", err.message)
      setSendError(t("chatWidget.sendError"))
      // Drop the optimistic bubble — it never actually made it, so the
      // conversation shouldn't claim it was sent.
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
      setDraft(text)
    } finally {
      setSending(false)
      sendingRef.current = false
    }
  }

  const handleSend = () => {
    const text = draft.trim()
    if (!text) return
    setDraft("")
    if (textareaRef.current) textareaRef.current.style.height = "auto"
    if (hasAccount) {
      sendAuthenticated(text)
    } else {
      appendLocalMessage({ sender: "user", text })
    }
  }

  const pingTyping = () => {
    if (!hasAccount) return
    const now = Date.now()
    if (now - lastTypingPingRef.current < TYPING_PING_INTERVAL_MS) return
    lastTypingPingRef.current = now
    api.post("/messages/mine/typing").catch(() => { })
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handlePlaceOrder = () => {
    if (hasAccount) {
      sendAuthenticated(t("chatWidget.orderIntentText"))
    } else {
      appendLocalMessage({ sender: "system", variant: "login-gate", text: t("chatWidget.loginGateMessage") })
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() =>
          isStaff
            ? router.push(
              `/dashboard/${role === "owner"
                ? "owner"
                : "admin"
              }/meldinger`
            )
            : setOpen((v) => !v)
        }
        aria-label={
          isStaff
            ? t("chatWidget.staffMessagesAriaLabel")
            : open
              ? t("chatWidget.closeChat")
              : t("chatWidget.openChat")
        }
        aria-expanded={
          isStaff ? undefined : open
        }
        className={`
    fixed
    [bottom:calc(22px+env(safe-area-inset-bottom,0px))]
    [right:calc(22px+env(safe-area-inset-right,0px))]
    z-[999]
    ${isHome ? "hidden lg:flex" : "flex"}
    h-[58px]
    w-[58px]
    items-center
    justify-center
    rounded-full
    bg-[#ff4b00]
    text-white
    shadow-[0_8px_28px_rgba(0,0,0,0.30)]
    transition-all
    duration-300
    hover:-translate-y-[2px]
    hover:shadow-[0_12px_32px_rgba(0,0,0,0.36)]
    active:translate-y-0
    active:scale-[0.97]
    sm:[bottom:calc(28px+env(safe-area-inset-bottom,0px))]
    sm:[right:calc(28px+env(safe-area-inset-right,0px))]
  `}
      >
        <span className="relative flex h-[22px] w-[22px] items-center justify-center">
          <MessageSquare
            size={22}
            strokeWidth={1.8}
            className={`absolute transition-all duration-200 ${!isStaff && open
                ? "scale-0 opacity-0"
                : "scale-100 opacity-100"
              }`}
          />

          {!isStaff && (
            <X
              size={22}
              strokeWidth={1.8}
              className={`absolute transition-all duration-200 ${open
                  ? "scale-100 opacity-100"
                  : "scale-0 opacity-0"
                }`}
            />
          )}
        </span>

        {!open && (
          <UnreadBadge
            count={
              isStaff
                ? staffUnreadCount
                : unreadCount
            }
            className="
        absolute
        -right-[4px]
        -top-[4px]
      "
          />
        )}
      </button>

      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-[997] bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 sm:hidden ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
      />

      <div
        className={`fixed inset-x-[12px] top-[76px] [bottom:calc(12px+env(safe-area-inset-bottom,0px))] z-[998] flex flex-col overflow-hidden rounded-[18px] border border-white/10 bg-[#111212] shadow-[0_24px_60px_rgba(0,0,0,0.55)] transition-all duration-300 sm:inset-x-auto sm:top-auto sm:bottom-[100px] sm:left-auto sm:right-[28px] sm:h-[600px] sm:max-h-[calc(100vh-140px)] sm:w-[380px] ${open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-[16px] opacity-0"
          }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 bg-[#0a0a0a] px-[18px] py-[15px]">
          <div>
            <div className="notranslate flex items-baseline leading-none" translate="no">
              <span className="text-[17px] font-[800] tracking-[-0.03em] text-[#ff4b00]">Pro</span>
              <span className="text-[17px] font-[800] tracking-[-0.03em] text-white">Visuell</span>
            </div>
            <p className="mt-[4px] text-[11px] text-white/50">
              {hasAccount ? t("chatWidget.loggedInAs", { name: getDisplayName(profile, firebaseUser) }) : t("chatWidget.replyTime")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("chatWidget.closeChat")}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div ref={listRef} translate="no" className="notranslate flex-1 space-y-[10px] overflow-y-auto px-[16px] py-[16px]">
          {messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}>
              <div
                translate="no"
                className={`notranslate max-w-[85%] whitespace-pre-wrap break-words px-[14px] py-[9px] text-[13.5px] leading-[1.45] ${m.sender === "user"
                    ? "rounded-[14px] rounded-br-[4px] bg-[#ff4b00] text-white"
                    : "rounded-[14px] rounded-bl-[4px] border border-white/10 bg-white/[0.06] text-white/85"
                  }`}
              >
                {m.id === "welcome" ? t("chatWidget.welcomeMessage") : m.variant === "login-gate" ? t("chatWidget.loginGateMessage") : m.text}
              </div>
              {m.variant === "login-gate" && (
                <div className="mt-[8px] flex gap-[8px]">
                  <Link
                    href="/login"
                    className="rounded-[8px] bg-[#ff4b00] px-[12px] py-[7px] text-[12px] font-[700] text-white hover:brightness-110"
                  >
                    {t("chatWidget.login")}
                  </Link>
                  <Link
                    href="/signup"
                    className="rounded-[8px] border border-white/20 px-[12px] py-[7px] text-[12px] font-[700] text-white hover:bg-white/[0.06]"
                  >
                    {t("chatWidget.signup")}
                  </Link>
                </div>
              )}
              {m.time && <span className="mt-[3px] px-[2px] text-[10px] text-white/30">{formatTime(m.time)}</span>}
            </div>
          ))}
          {isRecent(adminTypingAt) && <TypingBubble />}
        </div>

        {sendError && (
          <div className="mx-[14px] mb-[8px] flex items-center gap-[7px] rounded-[8px] border border-red-500/25 bg-red-500/10 px-[12px] py-[7px] text-[12px] text-red-300">
            <AlertCircle size={13} className="shrink-0" />
            {sendError}
          </div>
        )}

        <div className="border-t border-white/10 px-[14px] pt-[10px]">
          <div className="mb-[8px] grid grid-cols-2 gap-[8px]">
            <button
              type="button"
              onClick={() => (hasAccount ? setShowBooking(true) : setShowLoginRequired(true))}
              className="inline-flex items-center justify-center gap-[6px] rounded-[10px] border border-white/15 px-[10px] py-[8px] text-[11px] font-[700] uppercase tracking-[0.02em] text-white/80 transition-colors hover:bg-white/[0.06]"
            >
              <CalendarClock size={13} />
              {t("chatWidget.bookMeeting")}
            </button>
            <button
              type="button"
              onClick={() => setShowEmail(true)}
              className="inline-flex items-center justify-center gap-[6px] rounded-[10px] border border-white/15 px-[10px] py-[8px] text-[11px] font-[700] uppercase tracking-[0.02em] text-white/80 transition-colors hover:bg-white/[0.06]"
            >
              <Mail size={13} />
              {t("common.sendEmail")}
            </button>
          </div>
          <button
            type="button"
            onClick={handlePlaceOrder}
            disabled={sending}
            className="mb-[10px] inline-flex w-full items-center justify-center gap-[8px] rounded-[10px] border border-[#ff4b00]/70 px-[14px] py-[9px] text-[12px] font-[700] uppercase tracking-[0.03em] text-[#ff4b00] transition-colors duration-200 hover:bg-[#ff4b00] hover:text-white disabled:opacity-50"
          >
            <ShoppingBag size={14} />
            {t("chatWidget.placeOrder")}
          </button>
        </div>

        <div className="flex items-end gap-[10px] border-t border-white/10 px-[14px] py-[12px]">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              if (sendError) setSendError("")
              pingTyping()
              const el = e.target
              el.style.height = "auto"
              el.style.height = `${Math.min(el.scrollHeight, 88)}px`
            }}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={t("chatWidget.messagePlaceholder")}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="none"
            autoComplete="off"
            translate="no"
            className="notranslate max-h-[88px] flex-1 resize-none rounded-[12px] border border-white/10 bg-white/[0.05] px-[12px] py-[10px] text-[13.5px] text-white placeholder-white/40 outline-none transition-colors focus:border-[#ff4b00]"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            aria-label={t("chatWidget.sendMessageAriaLabel")}
            className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-[#ff4b00] text-white transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {showBooking && <BookMeetingModal onClose={() => setShowBooking(false)} />}
      {showLoginRequired && (
        <LoginRequiredModal
          title={t("chatWidget.loginRequiredTitle")}
          message={t("chatWidget.loginRequiredMessage")}
          onClose={() => setShowLoginRequired(false)}
        />
      )}
      {showEmail && <EmailComposeModal onClose={() => setShowEmail(false)} />}
    </>
  )
}

export default ChatWidget