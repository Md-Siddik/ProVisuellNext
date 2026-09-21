"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, Check, CheckCheck } from "lucide-react"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { OPEN_CHAT_EVENT } from "./StartOrderModal"

// Notifications are stored server-side with their Norwegian text. They are
// translated here at display time (matched on the stored title), so the bell
// follows the selected language for old and new notifications alike.
const TITLE_KEYS = {
  "Ny avtale booket": "notifications.titleAppointmentBooked",
  "Ny faktura fra ProVisuell": "notifications.titleInvoiceSent",
  "Ny melding fra kunde": "notifications.titleChatMessage",
  "Nytt svar fra ProVisuell": "notifications.titleChatReply",
  "Ny ordre venter på godkjenning": "notifications.titleOrderCreated",
  "Bestillingen din er godkjent": "notifications.titleOrderApproved",
  "Bestillingen din ble avvist": "notifications.titleOrderRejected",
  "Bestillingen din er fullført": "notifications.titleOrderCompleted",
  "Ny e-post fra nettsiden": "notifications.titleContactEmail",
}

const LOCALE_MAP = { no: "no-NO", en: "en-US", sv: "sv-SE", fi: "fi-FI", da: "da-DK" }

// Shared between the public Header and the dashboard topbar — every place
// an authenticated user can see notifications reads from the same API.
export default function NotificationBell() {
  const { t, language } = useTranslation()

  const timeAgo = (iso) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return t("notifications.justNow")
    if (mins < 60) return t("notifications.minutesShort", { n: mins })
    const hours = Math.floor(mins / 60)
    if (hours < 24) return t("notifications.hoursShort", { n: hours })
    return new Date(iso).toLocaleDateString(LOCALE_MAP[language] || "no-NO", { day: "numeric", month: "short" })
  }

  const localizeNotification = (n) => {
    let title = n.title
    let message = n.message
    if (TITLE_KEYS[n.title]) {
      title = t(TITLE_KEYS[n.title])
    } else {
      const reminder = /^Påminnelse om (\d+) ubetalte?\b/.exec(n.title || "")
      if (reminder) {
        title = Number(reminder[1]) === 1 ? t("notifications.titleInvoiceReminderOne") : t("notifications.titleInvoiceReminderMany", { n: reminder[1] })
      }
    }
    const due = n.type === "invoice_sent" && /^(.+) — forfaller (.+)$/.exec(message || "")
    if (due) message = t("notifications.msgInvoiceDue", { number: due[1], date: due[2] })
    const statement = n.type === "invoice_reminder" && /^Samlefaktura (.+) — kr (.+) utestående$/.exec(message || "")
    if (statement) message = t("notifications.msgStatementDue", { number: statement[1], amount: statement[2] })
    return { title, message }
  }

  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const boxRef = useRef(null)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const { count } = await api.get("/notifications/unread-count")
        if (!cancelled) setUnreadCount(count)
      } catch {
        // ignore — badge just won't update this tick
      }
    }
    check()
    const interval = setInterval(check, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const onClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [])

  const toggleOpen = async () => {
    const next = !open
    setOpen(next)
    if (next) {
      try {
        const { notifications } = await api.get("/notifications")
        setNotifications(notifications)
        setLoaded(true)
      } catch {
        // leave whatever was already loaded
      }
    }
  }

  const markRead = (id) => {
    setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)))
    setUnreadCount((c) => Math.max(0, c - 1))
    api.post(`/notifications/${id}/read`).catch(() => {})
  }

  const handleClickNotification = (n) => {
    setOpen(false)
    if (!n.read) markRead(n._id)
    // A customer's chat reply has no dedicated page — it lives in the
    // floating ChatWidget, so open that instead of just landing on "/".
    if (n.type === "chat_reply") window.dispatchEvent(new Event(OPEN_CHAT_EVENT))
    if (n.link) router.push(n.link)
  }

  const handleMarkReadClick = (e, id) => {
    e.stopPropagation()
    markRead(id)
  }

  const markAllRead = async () => {
    // Nothing to do, and guards against a double-click firing the request
    // twice while the first one is still in flight.
    if (markingAll || !notifications.some((n) => !n.read)) return
    setMarkingAll(true)
    setUnreadCount(0)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    try {
      await api.post("/notifications/mark-all-read")
    } catch {
      // Best-effort — the next open/poll will reconcile the real state.
    } finally {
      setMarkingAll(false)
    }
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={t("notifications.ariaLabel")}
        className="relative flex h-[36px] w-[36px] items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.05] text-white/80 backdrop-blur-sm transition-all duration-200 hover:border-white/25 hover:bg-white/[0.09] hover:text-white"
      >
        <Bell size={16.5} strokeWidth={1.9} />
        {unreadCount > 0 && (
          <span className="absolute -right-[3px] -top-[3px] flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#ff4b00] px-[4px] text-[9px] font-[800] leading-none text-white shadow-[0_0_0_2.5px_#0a0a0a,0_2px_6px_rgba(255,75,0,0.55)]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-[12px] top-[76px] z-50 overflow-hidden rounded-[12px] border border-white/10 bg-[#141515] shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-[320px]">
          <div className="flex items-center justify-between border-b border-white/10 px-[14px] py-[11px]">
            <p className="text-[13px] font-[700] text-white">{t("notifications.title")}</p>
            {notifications.some((n) => !n.read) && (
              <button
                type="button"
                onClick={markAllRead}
                disabled={markingAll}
                className="flex items-center gap-[5px] text-[11px] font-[600] text-white/50 hover:text-white disabled:opacity-50"
              >
                <CheckCheck size={12} />
                {t("notifications.markAllRead")}
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {!loaded && <p className="px-[14px] py-[20px] text-center text-[12.5px] text-white/40">{t("notifications.loading")}</p>}
            {loaded && notifications.length === 0 && (
              <p className="px-[14px] py-[20px] text-center text-[12.5px] text-white/40">{t("notifications.empty")}</p>
            )}
            {notifications.map((n) => (
              <button
                key={n._id}
                type="button"
                onClick={() => handleClickNotification(n)}
                className={`group flex w-full flex-col items-start gap-[3px] border-b border-white/[0.06] px-[14px] py-[11px] text-left transition-colors last:border-0 hover:bg-white/[0.05] ${
                  n.read ? "" : "bg-[#ff4b00]/[0.05]"
                }`}
              >
                <span className="flex w-full items-center gap-[6px]">
                  {!n.read && <span className="h-[6px] w-[6px] shrink-0 rounded-full bg-[#ff4b00]" />}
                  <span className="truncate text-[12.5px] font-[700] text-white">{localizeNotification(n).title}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-white/35">{timeAgo(n.createdAt)}</span>
                  {!n.read && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => handleMarkReadClick(e, n._id)}
                      aria-label={t("notifications.markRead")}
                      title={t("notifications.markRead")}
                      className="shrink-0 rounded-full p-[3px] text-white/35 opacity-0 transition-opacity hover:bg-white/10 hover:text-white group-hover:opacity-100"
                    >
                      <Check size={12} />
                    </span>
                  )}
                </span>
                {n.message && <span className="truncate text-[11.5px] text-white/50">{localizeNotification(n).message}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}