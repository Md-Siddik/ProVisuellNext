"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, Lock, Mail } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { friendlyAuthError, logAuthError, loginWithEmail, loginWithGoogle, loginWithMicrosoft, resetPassword } from "@/lib/firebaseAuth"
import { useTranslation } from "@/lib/i18n"
import GoogleAuthButton from "@/components/auth/GoogleAuthButton"

// Microsoft sign-in is wired up but stays hidden until that OAuth provider
// is enabled and tested in the Firebase console. Flip this back on when
// it's ready — no other changes needed.
const MICROSOFT_ENABLED = false

function LoginForm() {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  // Prefilled when arriving from a just-confirmed signup link.
  const [email, setEmail] = useState(() => searchParams.get("email") || "")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [awaitingProfile, setAwaitingProfile] = useState(false)
  // Which sign-in button is working (popup open or account being checked).
  const [oauthBusy, setOauthBusy] = useState(null)

  const router = useRouter()
  const redirectTo = searchParams.get("from") || "/dashboard"
  const { loading, isAuthenticated, needsEmailVerification, accountBlock, clearAccountBlock } = useAuth()

  // The server refused the account (banned): stop waiting for a
  // profile that will never come and say why.
  useEffect(() => {
    if (!accountBlock) return
    setAwaitingProfile(false)
    setSubmitting(false)
    setOauthBusy(null)
  }, [accountBlock])

  // See Signup.jsx for why this waits for `loading` to settle rather than
  // navigating the instant Firebase resolves. A password account that
  // hasn't confirmed its email yet is sent to the verification screen
  // instead of straight into the app.
  useEffect(() => {
    if (awaitingProfile && !loading && isAuthenticated) {
      router.replace(needsEmailVerification ? "/verify-email" : redirectTo)
    }
  }, [awaitingProfile, loading, isAuthenticated, needsEmailVerification, router, redirectTo])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setInfo("")
    clearAccountBlock()
    setSubmitting(true)
    try {
      await loginWithEmail(email, password)
      setAwaitingProfile(true)
    } catch (err) {
      setError(friendlyAuthError(err))
      setSubmitting(false)
    }
  }

  // Firebase first (popup), then AuthContext checks the account with the
  // server; the redirect below waits for that. A refused account (banned /
  // deleted) comes back as accountBlock and is signed out again.
  const handleOAuth = async (provider) => {
    setError("")
    clearAccountBlock()
    setSubmitting(true)
    setOauthBusy(provider)
    try {
      if (provider === "google") await loginWithGoogle()
      else await loginWithMicrosoft()
      setAwaitingProfile(true)
    } catch (err) {
      logAuthError(err)
      setError(friendlyAuthError(err))
      setSubmitting(false)
      setOauthBusy(null)
    }
  }

  const handleForgotPassword = async () => {
    setError("")
    setInfo("")
    if (!email) {
      setError(t("login.forgotPasswordEmailRequired"))
      return
    }
    try {
      await resetPassword(email)
      setInfo(t("login.resetEmailSent"))
    } catch (err) {
      setError(friendlyAuthError(err))
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-black text-white">
      <div className="flex w-full flex-col justify-center px-[28px] py-[48px] pt-[110px] sm:px-[56px] lg:w-1/2 lg:px-[72px]">
        <div className="mx-auto w-full max-w-[416px]">
          <h1 className="text-[34px] font-[800] tracking-[-0.02em] text-white">{t("login.title")}</h1>
          <p className="mt-[10px] text-[14px] leading-[1.5] text-white/55">
            {t("login.subtitle")}
          </p>

          {accountBlock && !error && (
            <div role="alert" className="mt-[22px] rounded-[10px] border border-red-500/30 bg-red-500/10 px-[14px] py-[10px] text-[13px] text-red-300">
              {t("login.accountBanned")}
            </div>
          )}
          {error && (
            <div className="mt-[22px] rounded-[10px] border border-red-500/30 bg-red-500/10 px-[14px] py-[10px] text-[13px] text-red-300">
              {error}
            </div>
          )}
          {info && (
            <div className="mt-[22px] rounded-[10px] border border-emerald-500/30 bg-emerald-500/10 px-[14px] py-[10px] text-[13px] text-emerald-300">
              {info}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-[22px]">
            <label className="block text-[13px] font-[600] text-white/80">{t("login.emailLabel")}</label>
            <div className="mt-[8px] flex items-center gap-[10px] rounded-[10px] border border-white/15 bg-white/[0.03] px-[14px] py-[13px] focus-within:border-[#ff4b00]">
              <Mail size={16} className="shrink-0 text-white/40" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("login.emailPlaceholder")}
                className="w-full bg-transparent text-[14px] text-white placeholder-white/35 outline-none"
              />
            </div>

            <label className="mt-[18px] block text-[13px] font-[600] text-white/80">{t("login.passwordLabel")}</label>
            <div className="mt-[8px] flex items-center gap-[10px] rounded-[10px] border border-white/15 bg-white/[0.03] px-[14px] py-[13px] focus-within:border-[#ff4b00]">
              <Lock size={16} className="shrink-0 text-white/40" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-transparent text-[14px] text-white placeholder-white/35 outline-none"
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="shrink-0 text-white/40 hover:text-white/70">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="mt-[16px] flex items-center justify-between">
              <label className="flex items-center gap-[8px] text-[13px] text-white/70">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-[15px] w-[15px] rounded border-white/30 bg-transparent accent-[#ff4b00]"
                />
                {t("login.rememberMe")}
              </label>
              <button type="button" onClick={handleForgotPassword} className="text-[13px] text-[#ff4b00] hover:underline">
                {t("login.forgotPassword")}
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-[22px] flex w-full items-center justify-center gap-[10px] rounded-[10px] bg-[#ff4b00] py-[14px] text-[13px] font-[800] uppercase tracking-[0.03em] text-white transition hover:brightness-110 disabled:opacity-50"
            >
              {submitting ? t("login.submitting") : t("login.submitButton")}
              {!submitting && <span aria-hidden>→</span>}
            </button>
          </form>

          <div className="mt-[26px] flex items-center gap-[14px] text-[11px] uppercase tracking-[0.08em] text-white/35">
            <span className="h-px flex-1 bg-white/10" />
            {t("login.orContinueWith")}
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <div className="mt-[18px] space-y-[10px]">
            <GoogleAuthButton label={t("login.continueWithGoogle")} onClick={() => handleOAuth("google")} disabled={submitting} busy={oauthBusy === "google"} />
            {MICROSOFT_ENABLED && (
              <button
                type="button"
                onClick={() => handleOAuth("microsoft")}
                disabled={submitting}
                className="flex w-full items-center justify-center gap-[10px] rounded-[10px] border border-white/15 bg-white/[0.03] py-[12px] text-[14px] text-white transition hover:bg-white/[0.07] disabled:opacity-50"
              >
                <MicrosoftIcon />
                {t("login.continueWithMicrosoft")}
              </button>
            )}
          </div>

          <p className="mt-[26px] text-center text-[13px] text-white/55">
            {t("login.noAccount")}{" "}
            <Link href="/signup" className="font-[600] text-[#ff4b00] hover:underline">
              {t("login.signupLink")}
            </Link>
          </p>
        </div>
      </div>

      <div className="relative hidden w-1/2 overflow-hidden bg-[#0a0a0a] lg:block">
        <img src="/assets/packaging-hero.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
      </div>
    </div>
  )
}

function MicrosoftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 21 21">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
