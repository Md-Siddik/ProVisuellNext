"use client"

import { useState } from "react"
import { CheckCircle2, Mail, X } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { getDisplayName } from "@/lib/displayName"

const BUSINESS_EMAIL = process.env.NEXT_PUBLIC_BUSINESS_EMAIL || "post@provisuell.no"

export default function EmailComposeModal({ onClose }) {
  const { t } = useTranslation()
  const { profile, firebaseUser } = useAuth()
  // A signed-in visitor writes as themselves: name and email come from the
  // account and are locked. Anonymous visitors have nothing to pull from, so
  // theirs stay editable — otherwise they could never send anything.
  const accountName = firebaseUser ? getDisplayName(profile, firebaseUser) : ""
  const accountEmail = firebaseUser ? profile?.email || firebaseUser.email || "" : ""
  const nameLocked = Boolean(accountName)
  const emailLocked = Boolean(accountEmail)
  const [typedName, setName] = useState("")
  const [typedEmail, setEmail] = useState("")
  const name = nameLocked ? accountName : typedName
  const email = emailLocked ? accountEmail : typedEmail
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [notConfigured, setNotConfigured] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSendDirect = async (e) => {
    e.preventDefault()
    setError("")
    setNotConfigured(false)
    setSending(true)
    try {
      await api.public.post("/email/send", { name, email, message })
      setSent(true)
    } catch (err) {
      const raw = (err.rawMessage || err.message || "").toLowerCase()
      if (raw.includes("not configured") || raw.includes("isn't configured")) {
        setNotConfigured(true)
      } else {
        setError(err.message)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-[16px]" onClick={onClose}>
      <div
        className="w-full max-w-[440px] rounded-[16px] border border-white/10 bg-[#111212] p-[24px] text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <div className="text-center">
            <div className="mx-auto flex h-[56px] w-[56px] items-center justify-center rounded-full border-2 border-emerald-500/40 text-emerald-400">
              <CheckCircle2 size={26} />
            </div>
            <h2 className="mt-[16px] text-[19px] font-[800] text-white">{t("emailComposeModal.sentTitle")}</h2>
            <p className="mt-[8px] text-[13.5px] leading-[1.5] text-white/60">{t("emailComposeModal.sentMessage")}</p>
            <button
              onClick={onClose}
              className="mt-[20px] w-full rounded-[10px] bg-[#ff4b00] py-[11px] text-[13px] font-[800] uppercase tracking-[0.02em] text-white hover:brightness-110"
            >
              {t("emailComposeModal.close")}
            </button>
          </div>
        ) : (
          <>
            <div className="mb-[18px] flex items-center justify-between">
              <div className="flex items-center gap-[10px]">
                <Mail size={18} className="text-[#ff4b00]" />
                <h2 className="text-[18px] font-[800] text-white">{t("emailComposeModal.title")}</h2>
              </div>
              <button onClick={onClose} className="text-white/50 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {error && <p className="mb-[14px] rounded-[8px] bg-red-500/10 px-[12px] py-[8px] text-[13px] text-red-300">{error}</p>}
            {notConfigured && (
              <p className="mb-[14px] rounded-[8px] border border-orange-500/30 bg-orange-500/10 px-[12px] py-[9px] text-[12.5px] leading-[1.4] text-orange-300">
                {t("emailComposeModal.notConfiguredMessage")}{" "}
                <a href={`mailto:${BUSINESS_EMAIL}`} className="underline">
                  {BUSINESS_EMAIL}
                </a>
                .
              </p>
            )}

            <form onSubmit={handleSendDirect} className="space-y-[14px]">
              <div>
                <label className="mb-[6px] block text-[12px] font-[600] text-white/70">{t("emailComposeModal.nameLabel")}</label>
                <input
                  required
                  value={name}
                  readOnly={nameLocked}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[12px] py-[9px] text-[13px] outline-none focus:border-[#ff4b00] ${nameLocked ? "cursor-not-allowed text-white/60" : "text-white"}`}
                />
              </div>
              <div>
                <label className="mb-[6px] block text-[12px] font-[600] text-white/70">{t("emailComposeModal.emailLabel")}</label>
                <input
                  type="email"
                  required
                  value={email}
                  readOnly={emailLocked}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[12px] py-[9px] text-[13px] outline-none focus:border-[#ff4b00] ${emailLocked ? "cursor-not-allowed text-white/60" : "text-white"}`}
                />
              </div>
              <div>
                <label className="mb-[6px] block text-[12px] font-[600] text-white/70">{t("emailComposeModal.messageLabel")}</label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("emailComposeModal.messagePlaceholder")}
                  className="w-full resize-none rounded-[8px] border border-white/15 bg-white/[0.04] px-[12px] py-[9px] text-[13px] text-white outline-none focus:border-[#ff4b00]"
                />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="flex w-full items-center justify-center gap-[8px] rounded-[10px] bg-[#ff4b00] py-[11px] text-[12.5px] font-[800] uppercase tracking-[0.02em] text-white hover:brightness-110 disabled:opacity-50"
              >
                <Mail size={14} />
                {sending ? t("emailComposeModal.sending") : t("emailComposeModal.sendDirect")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}