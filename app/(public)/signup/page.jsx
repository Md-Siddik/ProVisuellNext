"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { friendlyAuthError, loginWithGoogle, loginWithMicrosoft, signUpWithEmail } from "@/lib/firebaseAuth"
import { useTranslation } from "@/lib/i18n"

// Kept in sync with Login.jsx's flag — see the comment there.
const MICROSOFT_ENABLED = false

export default function SignupPage() {
  const { t } = useTranslation()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [awaitingProfile, setAwaitingProfile] = useState(false)
  const router = useRouter()
  const { loading, isAuthenticated, needsEmailVerification } = useAuth()

  // Don't navigate the instant Firebase resolves — AuthContext's own
  // profile sync (which resolves the role the redirect depends on) is
  // still in flight at that point. Navigating here, only once loading
  // has actually settled, is what makes the role-based redirect reliable
  // instead of racing a still-pending network call. A brand-new
  // email/password account is unverified at this point, so it goes to the
  // verification screen rather than straight into the app.
  useEffect(() => {
    if (awaitingProfile && !loading && isAuthenticated) {
      router.replace(needsEmailVerification ? "/verify-email" : "/dashboard")
    }
  }, [awaitingProfile, loading, isAuthenticated, needsEmailVerification, router])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      await signUpWithEmail(name, email, password)
      setAwaitingProfile(true)
    } catch (err) {
      setError(friendlyAuthError(err))
      setSubmitting(false)
    }
  }

  const handleOAuth = async (provider) => {
    setError("")
    setSubmitting(true)
    try {
      if (provider === "google") await loginWithGoogle()
      else await loginWithMicrosoft()
      setAwaitingProfile(true)
    } catch (err) {
      setError(friendlyAuthError(err))
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-black text-white">
      <div className="flex w-full flex-col justify-center px-[28px] py-[48px] pt-[110px] sm:px-[56px] lg:w-1/2 lg:px-[72px]">
        <div className="mx-auto w-full max-w-[416px]">
          <h1 className="text-[34px] font-[800] tracking-[-0.02em] text-white">{t("signup.title")}</h1>
          <p className="mt-[10px] text-[14px] leading-[1.5] text-white/55">
            {t("signup.subtitle")}
          </p>

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

            <button
              type="submit"
              disabled={submitting}
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
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-[10px] rounded-[10px] border border-white/15 bg-white/[0.03] py-[12px] text-[14px] text-white transition hover:bg-white/[0.07] disabled:opacity-50"
            >
              {t("signup.continueWithGoogle")}
            </button>
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
      </div>

      <div className="relative hidden w-1/2 overflow-hidden bg-[#0a0a0a] lg:block">
        <img src="/assets/vehicle-hero.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
      </div>
    </div>
  )
}
