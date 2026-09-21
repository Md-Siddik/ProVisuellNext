"use client"

import { useEffect, useRef, useState } from "react"
import { getLocale } from "@/lib/i18n/locale"
import { useSearchParams } from "next/navigation"
import { AlertCircle, ChevronLeft, Mail, MessageSquare, Send } from "lucide-react"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"

const TYPING_STALE_MS = 5000
const TYPING_POLL_MS = 2500
const TEXTAREA_MAX_HEIGHT = 88

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

function timeAgo(iso, t) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t("messagesPage.timeJustNow")
  if (mins < 60) return t("messagesPage.timeMinutes", { n: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t("messagesPage.timeHours", { n: hours })
  return new Date(iso).toLocaleDateString(getLocale(), { day: "numeric", month: "short" })
}

export default function Meldinger() {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState(searchParams.get("tab") === "emails" ? "emails" : "chats")
  const [emails, setEmails] = useState([])
  const [loadingEmails, setLoadingEmails] = useState(true)
  const [activeEmailId, setActiveEmailId] = useState(null)
  const [emailDraft, setEmailDraft] = useState("")
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSendError, setEmailSendError] = useState("")
  const emailListRef = useRef(null)
  const emailTextareaRef = useRef(null)
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [active, setActive] = useState(null)
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")
  const [customerTypingAt, setCustomerTypingAt] = useState(null)
  // Below `lg`, the list and the open thread are two separate full-width
  // screens (not a permanent split view) — this tracks which one is showing.
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const listRef = useRef(null)
  const textareaRef = useRef(null)
  const lastTypingPingRef = useRef(0)
  // Shared by every fetch that can overwrite `active` (initial load, the
  // live poll, and sending a reply) — each grabs a ticket before awaiting
  // and only applies its result if no newer request has started since.
  // Without this, a slow poll response landing after you hit send could
  // overwrite your just-sent reply with stale server data, making the
  // thread appear to show a different message than what was typed.
  //
  // Two different guards are needed, not one shared counter: switching
  // conversations must discard any response for the conversation you left
  // (activeGenerationRef, bumped only on switch) — but a live poll must
  // never be allowed to overwrite state while a send to the SAME
  // conversation is in flight, even if the poll started afterward. A
  // "last request wins" rule gets this backwards: if the poll's GET reads
  // the conversation before the send's POST has actually committed, the
  // poll "wins" and wipes the optimistic message — and then the send's own
  // (correct, authoritative) response gets discarded for being "older",
  // even though the message really was saved. sendingRef closes that gap.
  const activeGenerationRef = useRef(0)
  const sendingRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function load(isFirst) {
      try {
        const { conversations } = await api.get("/messages")
        if (cancelled) return
        setConversations(conversations)
        if (isFirst && conversations.length > 0) setActiveId(conversations[0]._id)
      } catch (err) {
        console.error(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load(true)
    // Poll so a brand new conversation (or one moving to the top, or an
    // unread badge appearing on another thread) shows up without a manual
    // refresh.
    const interval = setInterval(() => load(false), 8000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // A notification linking to ?tab=emails can land while this page is
  // already open, so the tab follows the URL rather than only its first value.
  const tabParam = searchParams.get("tab")
  useEffect(() => {
    if (tabParam === "emails") setTab("emails")
  }, [tabParam])

  useEffect(() => {
    let cancelled = false
    async function loadEmails() {
      try {
        const { emails } = await api.get("/contact-emails")
        if (!cancelled) setEmails(emails)
      } catch (err) {
        console.error(err)
      } finally {
        if (!cancelled) setLoadingEmails(false)
      }
    }
    loadEmails()
    const interval = setInterval(loadEmails, 8000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const unreadEmails = emails.filter((m) => !m.read).length
  const activeEmail = emails.find((m) => m._id === activeEmailId) || null

  const handleEmailDraftChange = (e) => {
    setEmailDraft(e.target.value)
    if (emailSendError) setEmailSendError("")
    const el = e.target
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`
  }

  const handleSendEmailReply = async () => {
    const text = emailDraft.trim()
    const targetId = activeEmailId
    if (!text || !targetId || sendingEmail) return
    setEmailSendError("")
    setSendingEmail(true)
    try {
      const { email } = await api.post(`/contact-emails/${targetId}/reply`, { text })
      setEmails((prev) => prev.map((e) => (e._id === targetId ? email : e)))
      setEmailDraft("")
      if (emailTextareaRef.current) emailTextareaRef.current.style.height = "auto"
    } catch (err) {
      console.error(err)
      setEmailSendError(t("messagesPage.sendError"))
    } finally {
      setSendingEmail(false)
    }
  }

  // Sending a reply mails the customer and can take a few seconds — the
  // thread only grows once that has actually succeeded, then follows it down.
  const activeReplyCount = activeEmail?.replies?.length || 0
  useEffect(() => {
    if (activeReplyCount > 0) emailListRef.current?.scrollTo({ top: emailListRef.current.scrollHeight, behavior: "smooth" })
  }, [activeEmailId, activeReplyCount])

  const switchTab = (next) => {
    setTab(next)
    setMobileDetailOpen(false)
  }

  const openEmail = (m) => {
    setActiveEmailId(m._id)
    setMobileDetailOpen(true)
    if (!m.read) {
      setEmails((prev) => prev.map((e) => (e._id === m._id ? { ...e, read: true } : e)))
      api.post(`/contact-emails/${m._id}/read`).catch((err) => console.error(err))
    }
  }

  useEffect(() => {
    if (!activeId) return
    activeGenerationRef.current += 1
    const myGeneration = activeGenerationRef.current
    setCustomerTypingAt(null)
    setSendError("")
    let cancelled = false
    async function load() {
      if (sendingRef.current) return // a reply to this conversation is in flight — let it settle first
      try {
        const { conversation } = await api.get(`/messages/${activeId}`)
        if (cancelled || sendingRef.current || myGeneration !== activeGenerationRef.current) return
        setActive(conversation)
        setCustomerTypingAt(conversation.typing?.user || null)
        // Opening this thread clears its unread badge server-side —
        // reflect that immediately in the sidebar instead of waiting for
        // the next 8s list poll.
        setConversations((prev) => prev.map((c) => (c._id === activeId ? { ...c, unreadAdminCount: 0 } : c)))
      } catch (err) {
        console.error(err)
      }
    }
    load()
    // Poll the open thread so a customer's new message — and typing status
    // — appears live.
    const interval = setInterval(load, TYPING_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [activeId])

  const pingTyping = () => {
    if (!activeId) return
    const now = Date.now()
    if (now - lastTypingPingRef.current < TYPING_POLL_MS) return
    lastTypingPingRef.current = now
    api.post(`/messages/${activeId}/typing`).catch(() => {})
  }

  // Follow the bottom only when the thread changes or grows — the open
  // thread is re-fetched every few seconds, and re-running this on every
  // poll would yank the view back down while someone is reading older messages.
  const activeThreadId = active?._id
  const activeMessageCount = active?.messages.length || 0
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })
  }, [activeThreadId, activeMessageCount, customerTypingAt, tab])

  const handleDraftChange = (e) => {
    setDraft(e.target.value)
    if (sendError) setSendError("")
    pingTyping()
    const el = e.target
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`
  }

  const handleSend = async () => {
    const text = draft.trim()
    const sendingTo = activeId
    if (!text || !sendingTo) return
    setSendError("")
    setDraft("")
    if (textareaRef.current) textareaRef.current.style.height = "auto"

    // Optimistic echo — the reply appears instantly instead of waiting on
    // the round trip, matching the customer-facing widget's feel.
    const optimisticId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    setActive((prev) =>
      prev && prev._id === sendingTo
        ? { ...prev, messages: [...prev.messages, { _id: optimisticId, sender: "admin", text, time: new Date().toISOString() }] }
        : prev
    )

    const myGeneration = activeGenerationRef.current
    setSending(true)
    sendingRef.current = true
    try {
      const { conversation } = await api.post(`/messages/${sendingTo}`, { text })
      // Only apply if the admin hasn't switched to a different conversation
      // while this was in flight — the send's own response is always
      // authoritative for its own conversation, regardless of any poll.
      if (myGeneration === activeGenerationRef.current) setActive(conversation)
      setConversations((prev) =>
        prev
          .map((c) => (c._id === sendingTo ? { ...c, lastMessageAt: conversation.lastMessageAt } : c))
          .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))
      )
    } catch (err) {
      console.error(err)
      setSendError(t("messagesPage.sendError"))
      setDraft(text) // restore the draft so a failed send doesn't silently lose what was typed
      // Drop the optimistic bubble again — it never actually made it.
      setActive((prev) => (prev && prev._id === sendingTo ? { ...prev, messages: prev.messages.filter((m) => m._id !== optimisticId) } : prev))
    } finally {
      setSending(false)
      sendingRef.current = false
    }
  }

  return (
    <div className="flex h-full min-h-[480px] flex-col">
      <div className="shrink-0">
        <h1 className="text-[26px] font-[800] tracking-[-0.02em] text-white">{t("messagesPage.title")}</h1>
        <p className="mt-[4px] text-[14px] text-white/50">{t("messagesPage.subtitle")}</p>
      </div>

      <div className="mt-[18px] grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden rounded-[14px] border border-white/[0.08] bg-[#111212] lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className={`min-h-0 flex-col border-b border-white/[0.08] lg:border-b-0 lg:border-r ${mobileDetailOpen ? "hidden lg:flex" : "flex"}`}>
          <div className="flex shrink-0 gap-[6px] border-b border-white/[0.06] p-[10px]">
            {[
              { id: "chats", label: t("messagesPage.tabChats"), icon: MessageSquare, unread: 0 },
              { id: "emails", label: t("messagesPage.tabEmails"), icon: Mail, unread: unreadEmails },
            ].map((tabItem) => (
              <button
                key={tabItem.id}
                type="button"
                onClick={() => switchTab(tabItem.id)}
                className={`flex flex-1 items-center justify-center gap-[7px] rounded-[8px] px-[10px] py-[8px] text-[12.5px] font-[700] transition-colors ${
                  tab === tabItem.id ? "bg-[#ff4b00]/15 text-[#ff4b00]" : "text-white/55 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <tabItem.icon size={14} />
                {tabItem.label}
                {tabItem.unread > 0 && (
                  <span className="flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#ff4b00] px-[5px] text-[10px] font-[800] text-white">
                    {tabItem.unread > 9 ? "9+" : tabItem.unread}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "chats" && (
              <>
                {loading && <p className="p-[16px] text-[13px] text-white/40">{t("messagesPage.loadingConversations")}</p>}
                {!loading && conversations.length === 0 && (
                  <p className="p-[16px] text-[13px] text-white/40">{t("messagesPage.noConversations")}</p>
                )}
                {conversations.map((c) => {
                  const unread = c.unreadAdminCount || 0
                  return (
                    <button
                      key={c._id}
                      onClick={() => {
                        setActiveId(c._id)
                        setMobileDetailOpen(true)
                      }}
                      className={`flex w-full items-center gap-[12px] border-b border-white/[0.06] px-[16px] py-[14px] text-left transition-colors ${
                        activeId === c._id ? "bg-[#ff4b00]/10" : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[13px] font-[700] text-white">
                        {(c.customerName || "?").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="notranslate min-w-0 flex-1" translate="no">
                        <p className={`truncate text-[13.5px] ${unread > 0 ? "font-[800] text-white" : "font-[700] text-white/90"}`}>
                          {c.customerName}
                        </p>
                        <p className="truncate text-[12px] text-white/45">{c.customerEmail}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-[5px]">
                        <span className="text-[11px] text-white/35">{timeAgo(c.lastMessageAt, t)}</span>
                        {unread > 0 && (
                          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ff4b00] px-[5px] text-[10px] font-[800] text-white">
                            {unread > 9 ? "9+" : unread}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </>
            )}

            {tab === "emails" && (
              <>
                {loadingEmails && <p className="p-[16px] text-[13px] text-white/40">{t("messagesPage.loadingEmails")}</p>}
                {!loadingEmails && emails.length === 0 && (
                  <p className="p-[16px] text-[13px] text-white/40">{t("messagesPage.noEmails")}</p>
                )}
                {emails.map((m) => (
                  <button
                    key={m._id}
                    onClick={() => openEmail(m)}
                    className={`flex w-full items-center gap-[12px] border-b border-white/[0.06] px-[16px] py-[14px] text-left transition-colors ${
                      activeEmailId === m._id ? "bg-[#ff4b00]/10" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[13px] font-[700] text-white">
                      {(m.name || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="notranslate min-w-0 flex-1" translate="no">
                      <p className={`truncate text-[13.5px] ${m.read ? "font-[700] text-white/90" : "font-[800] text-white"}`}>{m.name}</p>
                      <p className="truncate text-[12px] text-white/45">{m.message}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-[5px]">
                      <span className="text-[11px] text-white/35">{timeAgo(m.createdAt, t)}</span>
                      {!m.read && <span className="h-[8px] w-[8px] rounded-full bg-[#ff4b00]" />}
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        <div className={`min-h-0 min-w-0 flex-col ${mobileDetailOpen ? "flex" : "hidden lg:flex"}`}>
          {tab === "emails" ? (
            !activeEmail ? (
              <div className="flex flex-1 items-center justify-center p-[24px] text-[13px] text-white/40">
                {t("messagesPage.selectEmail")}
              </div>
            ) : (
              <>
                <div className="notranslate flex shrink-0 items-center gap-[10px] border-b border-white/[0.08] px-[18px] py-[14px]" translate="no">
                  <button
                    type="button"
                    onClick={() => setMobileDetailOpen(false)}
                    aria-label={t("messagesPage.backToEmails")}
                    className="-ml-[6px] flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-white/60 hover:bg-white/[0.06] hover:text-white lg:hidden"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-[700] text-white">{activeEmail.name}</p>
                    <p className="truncate text-[12px] text-white/45">{activeEmail.email}</p>
                  </div>
                  <span className="shrink-0 text-[11.5px] text-white/40">
                    {new Date(activeEmail.createdAt).toLocaleString(getLocale(), { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>

                <div ref={emailListRef} translate="no" className="notranslate min-h-0 flex-1 space-y-[10px] overflow-y-auto px-[18px] py-[16px]">
                  <div className="flex flex-col items-start">
                    <div
                      translate="no"
                      className="notranslate max-w-[75%] whitespace-pre-wrap break-words rounded-[14px] rounded-bl-[4px] border border-white/10 bg-white/[0.06] px-[14px] py-[9px] text-[13.5px] leading-[1.45] text-white/85"
                    >
                      {activeEmail.message}
                    </div>
                    <span className="mt-[3px] px-[2px] text-[10px] text-white/30">
                      {new Date(activeEmail.createdAt).toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {(activeEmail.replies || []).map((r) => (
                    <div key={r._id} className="flex flex-col items-end">
                      <div
                        translate="no"
                        className="notranslate max-w-[75%] whitespace-pre-wrap break-words rounded-[14px] rounded-br-[4px] bg-[#ff4b00] px-[14px] py-[9px] text-[13.5px] leading-[1.45] text-white"
                      >
                        {r.text}
                      </div>
                      <span className="mt-[3px] px-[2px] text-[10px] text-white/30">
                        {new Date(r.time).toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>

                {emailSendError && (
                  <div className="mx-[16px] mb-[8px] flex shrink-0 items-center gap-[7px] rounded-[8px] border border-red-500/25 bg-red-500/10 px-[12px] py-[7px] text-[12px] text-red-300">
                    <AlertCircle size={13} className="shrink-0" />
                    {emailSendError}
                  </div>
                )}

                <div className="flex shrink-0 items-end gap-[10px] border-t border-white/[0.08] px-[16px] py-[12px]">
                  <textarea
                    ref={emailTextareaRef}
                    value={emailDraft}
                    onChange={handleEmailDraftChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleSendEmailReply()
                      }
                    }}
                    rows={1}
                    placeholder={t("messagesPage.messagePlaceholder")}
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="none"
                    autoComplete="off"
                    translate="no"
                    className="notranslate max-h-[88px] flex-1 resize-none rounded-[12px] border border-white/10 bg-white/[0.05] px-[12px] py-[10px] text-[13.5px] text-white placeholder-white/40 outline-none transition-colors focus:border-[#ff4b00]"
                  />
                  <button
                    onClick={handleSendEmailReply}
                    disabled={sendingEmail || !emailDraft.trim()}
                    aria-label={t("messagesPage.sendAriaLabel")}
                    className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-[#ff4b00] text-white transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </>
            )
          ) : !active ? (
            <div className="flex flex-1 items-center justify-center p-[24px] text-[13px] text-white/40">
              {t("messagesPage.selectConversation")}
            </div>
          ) : (
            <>
              <div className="notranslate flex shrink-0 items-center gap-[10px] border-b border-white/[0.08] px-[18px] py-[14px]" translate="no">
                <button
                  type="button"
                  onClick={() => setMobileDetailOpen(false)}
                  aria-label={t("messagesPage.backToList")}
                  className="-ml-[6px] flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-white/60 hover:bg-white/[0.06] hover:text-white lg:hidden"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-[700] text-white">{active.customerName}</p>
                  <p className="truncate text-[12px] text-white/45">{active.customerEmail}</p>
                </div>
              </div>

              <div ref={listRef} translate="no" className="notranslate min-h-0 flex-1 space-y-[10px] overflow-y-auto px-[18px] py-[16px]">
                {active.messages.map((m) => (
                  <div key={m._id} className={`flex flex-col ${m.sender === "admin" ? "items-end" : "items-start"}`}>
                    <div
                      translate="no"
                      className={`notranslate max-w-[75%] whitespace-pre-wrap break-words px-[14px] py-[9px] text-[13.5px] leading-[1.45] ${
                        m.sender === "admin"
                          ? "rounded-[14px] rounded-br-[4px] bg-[#ff4b00] text-white"
                          : "rounded-[14px] rounded-bl-[4px] border border-white/10 bg-white/[0.06] text-white/85"
                      }`}
                    >
                      {m.text}
                    </div>
                    <span className="mt-[3px] px-[2px] text-[10px] text-white/30">
                      {new Date(m.time).toLocaleTimeString(getLocale(), { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
                {isRecent(customerTypingAt) && <TypingBubble />}
              </div>

              {sendError && (
                <div className="mx-[16px] mb-[8px] flex shrink-0 items-center gap-[7px] rounded-[8px] border border-red-500/25 bg-red-500/10 px-[12px] py-[7px] text-[12px] text-red-300">
                  <AlertCircle size={13} className="shrink-0" />
                  {sendError}
                </div>
              )}

              <div className="flex shrink-0 items-end gap-[10px] border-t border-white/[0.08] px-[16px] py-[12px]">
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={handleDraftChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  rows={1}
                  placeholder={t("messagesPage.messagePlaceholder")}
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="none"
                  autoComplete="off"
                  translate="no"
                  className="notranslate max-h-[88px] flex-1 resize-none rounded-[12px] border border-white/10 bg-white/[0.05] px-[12px] py-[10px] text-[13.5px] text-white placeholder-white/40 outline-none transition-colors focus:border-[#ff4b00]"
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !draft.trim()}
                  aria-label={t("messagesPage.sendAriaLabel")}
                  className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-[#ff4b00] text-white transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
