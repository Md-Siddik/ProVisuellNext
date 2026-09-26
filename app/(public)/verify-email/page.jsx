"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { CircleAlert, CircleCheck, LoaderCircle, MailCheck } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { confirmSignup, sendVerificationEmail, logout, friendlyAuthError } from "@/lib/firebaseAuth"
import { useTranslation } from "@/lib/i18n"
import { useCooldown } from "@/hooks/useCooldown"

// Two jobs:
//  - ?token=… — the link from our signup email. Confirming it is what
//    creates the account in Firebase (see app/api/auth/signup/verify).
//  - no token — a signed-in password account that still needs Firebase's
//    own verification (accounts created before the emailed-link signup).
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailRouter />
    </Suspense>
  )
}

function VerifyEmailRouter() {
  const token = useSearchParams().get("token")
  return token ? <ConfirmSignup token={token} /> : <PendingVerification />
}

function ConfirmSignup({ token }) {
  const { t } = useTranslation()
  const [state, setState] = useState({ status: "working", email: "", error: "" })
  // The link is single-use — never fire it twice (e.g. StrictMode's double effect).
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    confirmSignup(token)
      .then(({ email, alreadyVerified }) => setState({ status: "done", email, error: "", alreadyVerified: Boolean(alreadyVerified) }))
      .catch((err) => setState({ status: "failed", email: "", error: err.message || t("authErrors.generic") }))
  }, [token, t])

  const Icon = state.status === "working" ? LoaderCircle : state.status === "done" ? CircleCheck : CircleAlert
  const tone = state.status === "failed" ? "bg-red-500/15 text-red-400" : state.status === "done" ? "bg-emerald-500/15 text-emerald-400" : "bg-[#ff4b00]/15 text-[#ff4b00]"

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-black px-[24px] py-[48px] text-white">
      <div className="w-full max-w-[440px] text-center" aria-live="polite">
        <div className={`mx-auto flex h-[64px] w-[64px] items-center justify-center rounded-full ${tone}`}>
          <Icon size={28} className={state.status === "working" ? "animate-spin" : ""} />
        </div>

        {state.status === "working" && <h1 className="mt-[22px] text-[26px] font-[800] tracking-[-0.02em]">{t("verifyEmail.confirming")}</h1>}

        {state.status === "done" && (
          <>
            <h1 className="mt-[22px] text-[26px] font-[800] tracking-[-0.02em]">{state.alreadyVerified ? t("verifyEmail.alreadyVerifiedTitle") : t("verifyEmail.confirmedTitle")}</h1>
            <p className="mt-[10px] text-[14px] leading-[1.5] text-white/60">{t("verifyEmail.confirmedText", { email: state.email })}</p>
            <Link
              href={`/login?email=${encodeURIComponent(state.email)}`}
              className="mt-[26px] flex h-[46px] items-center justify-center rounded-[10px] bg-[#ff4b00] text-[13px] font-[800] uppercase tracking-[0.03em] text-white transition hover:brightness-110"
            >
              {t("verifyEmail.goToLogin")}
            </Link>
          </>
        )}

        {state.status === "failed" && (
          <>
            <h1 className="mt-[22px] text-[26px] font-[800] tracking-[-0.02em]">{t("verifyEmail.failedTitle")}</h1>
            <p className="mt-[10px] text-[14px] leading-[1.5] text-white/60">{state.error}</p>
            <div className="mt-[26px] flex flex-col gap-[10px]">
              <Link
                href="/signup"
                className="flex h-[46px] items-center justify-center rounded-[10px] bg-[#ff4b00] text-[13px] font-[800] uppercase tracking-[0.03em] text-white transition hover:brightness-110"
              >
                {t("verifyEmail.signUpAgain")}
              </Link>
              <Link href="/login" className="mt-[4px] text-[13px] text-white/45 hover:text-white/70">
                {t("verifyEmail.goToLogin")}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function PendingVerification() {
  const { t } = useTranslation()
  const { firebaseUser, needsEmailVerification, recheckEmailVerification, loading } = useAuth()
  const router = useRouter()
  const [resent, setResent] = useState(false)
  const [checking, setChecking] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState("")
  // One resend a minute per account, kept across reloads.
  const cooldown = useCooldown(firebaseUser ? `verify_${firebaseUser.uid}` : null, 60)

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
    if (cooldown.left > 0) return
    setError("")
    setResent(false)
    setResending(true)
    try {
      // Fresh state first — if they already verified in another tab, finish
      // instead of mailing another link.
      if (await recheckEmailVerification()) return
      await sendVerificationEmail(firebaseUser)
      cooldown.start()
      setResent(true)
    } catch (err) {
      if (err?.code === "auth/too-many-requests") cooldown.start()
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
            disabled={resending || cooldown.left > 0}
            className="flex h-[46px] items-center justify-center rounded-[10px] border border-white/15 bg-white/[0.03] text-[13px] font-[700] text-white transition hover:bg-white/[0.07] disabled:opacity-50"
          >
            {resending
              ? t("verifyEmail.resending")
              : cooldown.left > 0
                ? t("verifyEmail.resendIn", { n: cooldown.left })
                : t("verifyEmail.resend")}
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
