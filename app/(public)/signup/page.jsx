"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Lock, Mail, MailCheck, ShieldCheck, User } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { friendlyAuthError, logAuthError, loginWithGoogle, loginWithMicrosoft, signUpWithEmail } from "@/lib/firebaseAuth"
import GoogleAuthButton from "@/components/auth/GoogleAuthButton"
import { useTranslation } from "@/lib/i18n"
import { useCooldown } from "@/hooks/useCooldown"

// Kept in sync with Login.jsx's flag — see the comment there.
const MICROSOFT_ENABLED = false

export default function SignupPage() {
  const { t, language } = useTranslation()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState("")
  // Set once the verification link has gone out — swaps the form for a
  // "check your inbox" screen.
  const [sentTo, setSentTo] = useState("")
  const [resent, setResent] = useState(false)
  // Matches the server's one-email-a-minute limit, so the button says when
  // it can be used instead of failing.
  const cooldown = useCooldown(sentTo ? `signup_${sentTo.toLowerCase()}` : null, 60)
  const [submitting, setSubmitting] = useState(false)
  const [awaitingProfile, setAwaitingProfile] = useState(false)
  // Which sign-in button is working (popup open or account being checked).
  const [oauthBusy, setOauthBusy] = useState(null)
  const router = useRouter()
  const { loading, isAuthenticated, needsEmailVerification, accountBlock, clearAccountBlock } = useAuth()

  // The server refused the account (banned) and AuthContext signed
  // it out again: stop waiting and say why (shown above the form).
  useEffect(() => {
    if (!accountBlock) return
    setAwaitingProfile(false)
    setSubmitting(false)
    setOauthBusy(null)
  }, [accountBlock])

  // Don't navigate the instant Firebase resolves — AuthContext's own
  // profile sync (which resolves the role the redirect depends on) is
  // still in flight at that point. Navigating here, only once loading
  // has actually settled, is what makes the role-based redirect reliable
  // instead of racing a still-pending network call. Only the Google /
  // Microsoft buttons sign in from this page; email signups wait for the
  // emailed link first.
  useEffect(() => {
    if (awaitingProfile && !loading && isAuthenticated) {
      router.replace(needsEmailVerification ? "/verify-email" : "/dashboard")
    }
  }, [awaitingProfile, loading, isAuthenticated, needsEmailVerification, router])

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword

  const requestLink = async () => {
    await signUpWithEmail({ name: name.trim(), email: email.trim(), password, confirmPassword, lang: language })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    clearAccountBlock()
    // The verification link is only sent when both passwords match (the
    // server refuses a mismatch as well).
    if (password !== confirmPassword) {
      setError(t("signup.passwordMismatch"))
      return
    }
    setSubmitting(true)
    try {
      await requestLink()
      setSentTo(email.trim())
      try {
        localStorage.setItem(`provisuell_cooldown_signup_${email.trim().toLowerCase()}`, String(Date.now() + 60000))
      } catch {
        // storage unavailable — the server-side limit still applies
      }
    } catch (err) {
      setError(err.message || t("authErrors.generic"))
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    if (cooldown.left > 0) return
    setError("")
    setResent(false)
    setSubmitting(true)
    try {
      await requestLink()
      cooldown.start()
      setResent(true)
    } catch (err) {
      setError(err.message || t("authErrors.generic"))
    } finally {
      setSubmitting(false)
    }
  }

  const handleStartOver = () => {
    setSentTo("")
    setResent(false)
    setError("")
    setPassword("")
    setConfirmPassword("")
  }

  // Same Google sign-in as the Login page (lib/firebaseAuth.js); a new
  // Google user gets their profile from the server on the first sync.
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

  return (
    <div className="flex min-h-screen w-full bg-black text-white">
      <div className="flex w-full flex-col justify-center px-[28px] py-[48px] pt-[110px] sm:px-[56px] lg:w-1/2 lg:px-[72px]">
        {sentTo ? (
          <div className="mx-auto w-full max-w-[416px]">
            <div className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[#ff4b00]/15 text-[#ff4b00]">
              <MailCheck size={26} />
            </div>
            <h1 className="mt-[22px] text-[30px] font-[800] tracking-[-0.02em] text-white">{t("signup.checkInboxTitle")}</h1>
            <p className="mt-[10px] text-[14px] leading-[1.6] text-white/60">{t("signup.checkInboxText", { email: sentTo })}</p>
            <p className="mt-[10px] text-[13px] leading-[1.6] text-white/45">{t("signup.checkInboxHint")}</p>

            {error && (
              <div className="mt-[20px] rounded-[10px] border border-red-500/30 bg-red-500/10 px-[14px] py-[10px] text-[13px] text-red-300">{error}</div>
            )}
            {resent && !error && (
              <div className="mt-[20px] rounded-[10px] border border-emerald-500/30 bg-emerald-500/10 px-[14px] py-[10px] text-[13px] text-emerald-300">
                {t("verifyEmail.resent")}
              </div>
            )}

            <div className="mt-[24px] flex flex-col gap-[10px]">
              <button
                type="button"
                onClick={handleResend}
                disabled={submitting || cooldown.left > 0}
                className="flex h-[46px] items-center justify-center rounded-[10px] border border-white/15 bg-white/[0.03] text-[13px] font-[700] text-white transition hover:bg-white/[0.07] disabled:opacity-50"
              >
                {submitting ? t("verifyEmail.resending") : cooldown.left > 0 ? t("verifyEmail.resendIn", { n: cooldown.left }) : t("verifyEmail.resend")}
              </button>
              <button type="button" onClick={handleStartOver} className="mt-[4px] text-[13px] text-white/45 hover:text-white/70">
                {t("signup.useDifferentEmail")}
              </button>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-[416px]">
            <h1 className="text-[34px] font-[800] tracking-[-0.02em] text-white">{t("signup.title")}</h1>
            <p className="mt-[10px] text-[14px] leading-[1.5] text-white/55">
              {t("signup.subtitle")}
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

            <form onSubmit={handleSubmit} className="mt-[22px]">
              <label className="block text-[13px] font-[600] text-white/80">{t("signup.nameLabel")}</label>
              <div className="mt-[8px] flex items-center gap-[10px] rounded-[10px] border border-white/15 bg-white/[0.03] px-[14px] py-[13px] focus-within:border-[#ff4b00]">
                <User size={16} className="shrink-0 text-white/40" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("signup.namePlaceholder")}
                  className="w-full bg-transparent text-[14px] text-white placeholder-white/35 outline-none"
                />
              </div>

              <label className="mt-[18px] block text-[13px] font-[600] text-white/80">{t("signup.emailLabel")}</label>
              <div className="mt-[8px] flex items-center gap-[10px] rounded-[10px] border border-white/15 bg-white/[0.03] px-[14px] py-[13px] focus-within:border-[#ff4b00]">
                <Mail size={16} className="shrink-0 text-white/40" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("signup.emailPlaceholder")}
                  className="w-full bg-transparent text-[14px] text-white placeholder-white/35 outline-none"
                />
              </div>

              <label className="mt-[18px] block text-[13px] font-[600] text-white/80">{t("signup.passwordLabel")}</label>
              <div className="mt-[8px] flex items-center gap-[10px] rounded-[10px] border border-white/15 bg-white/[0.03] px-[14px] py-[13px] focus-within:border-[#ff4b00]">
                <Lock size={16} className="shrink-0 text-white/40" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("signup.passwordPlaceholder")}
                  className="w-full bg-transparent text-[14px] text-white placeholder-white/35 outline-none"
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="shrink-0 text-white/40 hover:text-white/70">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <label className="mt-[18px] block text-[13px] font-[600] text-white/80">{t("signup.confirmPasswordLabel")}</label>
              <div
                className={`mt-[8px] flex items-center gap-[10px] rounded-[10px] border bg-white/[0.03] px-[14px] py-[13px] ${
                  mismatch ? "border-red-500/60" : "border-white/15 focus-within:border-[#ff4b00]"
                }`}
              >
                <ShieldCheck size={16} className="shrink-0 text-white/40" />
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("signup.confirmPasswordPlaceholder")}
                  aria-invalid={mismatch || undefined}
                  aria-describedby={mismatch ? "confirm-password-error" : undefined}
                  className="w-full bg-transparent text-[14px] text-white placeholder-white/35 outline-none"
                />
                <button type="button" onClick={() => setShowConfirm((v) => !v)} className="shrink-0 text-white/40 hover:text-white/70">
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {mismatch && (
                <p id="confirm-password-error" className="mt-[6px] text-[12.5px] text-red-300">
                  {t("signup.passwordMismatch")}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || mismatch}
                className="mt-[22px] flex w-full items-center justify-center gap-[10px] rounded-[10px] bg-[#ff4b00] py-[14px] text-[13px] font-[800] uppercase tracking-[0.03em] text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {submitting ? t("signup.submitting") : t("signup.submitButton")}
                {!submitting && <span aria-hidden>→</span>}
              </button>
            </form>

            <div className="mt-[26px] flex items-center gap-[14px] text-[11px] uppercase tracking-[0.08em] text-white/35">
              <span className="h-px flex-1 bg-white/10" />
              {t("signup.orContinueWith")}
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="mt-[18px] space-y-[10px]">
              <GoogleAuthButton label={t("signup.continueWithGoogle")} onClick={() => handleOAuth("google")} disabled={submitting} busy={oauthBusy === "google"} />
              {MICROSOFT_ENABLED && (
                <button
                  type="button"
                  onClick={() => handleOAuth("microsoft")}
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-[10px] rounded-[10px] border border-white/15 bg-white/[0.03] py-[12px] text-[14px] text-white transition hover:bg-white/[0.07] disabled:opacity-50"
                >
                  {t("signup.continueWithMicrosoft")}
                </button>
              )}
            </div>

            <p className="mt-[26px] text-center text-[13px] text-white/55">
              {t("signup.haveAccount")}{" "}
              <Link href="/login" className="font-[600] text-[#ff4b00] hover:underline">
                {t("signup.loginLink")}
              </Link>
            </p>
          </div>
        )}
      </div>

      <div className="relative hidden w-1/2 overflow-hidden bg-[#0a0a0a] lg:block">
        <img src="/assets/vehicle-hero.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
      </div>
    </div>
  )
}
