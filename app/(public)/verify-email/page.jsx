"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { MailCheck } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { sendVerificationEmail, logout, friendlyAuthError } from "@/lib/firebaseAuth"
import { useTranslation } from "@/lib/i18n"

export default function VerifyEmailPage() {
  const { t } = useTranslation()
  const { firebaseUser, needsEmailVerification, recheckEmailVerification, loading } = useAuth()
  const router = useRouter()
  const [resent, setResent] = useState(false)
  const [checking, setChecking] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState("")

  // react-router's declarative <Navigate> has no App Router equivalent for
  // a Client Component render-time redirect — this effect mirrors what it
  // did (bounce away as soon as this page no longer applies).
  useEffect(() => {
    if (loading) return
    if (!firebaseUser) router.replace("/login")
    else if (!needsEmailVerification) router.replace("/dashboard")
  }, [loading, firebaseUser, needsEmailVerification, router])

  if (loading || !firebaseUser || !needsEmailVerification) return null

  const handleResend = async () => {
    setError("")
    setResent(false)
    setResending(true)
    try {
      await sendVerificationEmail(firebaseUser)
      setResent(true)
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setResending(false)
    }
  }

  const handleRecheck = async () => {
    setError("")
    setChecking(true)
    try {
      const verified = await recheckEmailVerification()
      if (!verified) setError(t("verifyEmail.notYetVerified"))
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setChecking(false)
    }
  }

  const handleUseDifferentAccount = async () => {
    await logout()
    router.replace("/login")
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-black px-[24px] py-[48px] text-white">
      <div className="w-full max-w-[440px] text-center">
        <div className="mx-auto flex h-[64px] w-[64px] items-center justify-center rounded-full bg-[#ff4b00]/15 text-[#ff4b00]">
          <MailCheck size={28} />
        </div>

        <h1 className="mt-[22px] text-[26px] font-[800] tracking-[-0.02em]">{t("verifyEmail.title")}</h1>
        <p className="mt-[10px] text-[14px] leading-[1.5] text-white/60">
          {t("verifyEmail.subtitle", { email: firebaseUser?.email || "" })}
        </p>

        {error && (
          <div className="mt-[18px] rounded-[10px] border border-red-500/30 bg-red-500/10 px-[14px] py-[10px] text-[13px] text-red-300">
            {error}
          </div>
        )}
        {resent && !error && (
          <div className="mt-[18px] rounded-[10px] border border-emerald-500/30 bg-emerald-500/10 px-[14px] py-[10px] text-[13px] text-emerald-300">
            {t("verifyEmail.resent")}
          </div>
        )}

        <div className="mt-[26px] flex flex-col gap-[10px]">
          <button
            type="button"
            onClick={handleRecheck}
            disabled={checking}
            className="flex h-[46px] items-center justify-center rounded-[10px] bg-[#ff4b00] text-[13px] font-[800] uppercase tracking-[0.03em] text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {checking ? t("verifyEmail.checking") : t("verifyEmail.checkAgain")}
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="flex h-[46px] items-center justify-center rounded-[10px] border border-white/15 bg-white/[0.03] text-[13px] font-[700] text-white transition hover:bg-white/[0.07] disabled:opacity-50"
          >
            {resending ? t("verifyEmail.resending") : t("verifyEmail.resend")}
          </button>
          <button
            type="button"
            onClick={handleUseDifferentAccount}
            className="mt-[4px] text-[13px] text-white/45 hover:text-white/70"
          >
            {t("verifyEmail.useDifferentAccount")}
          </button>
        </div>
      </div>
    </div>
  )
}
