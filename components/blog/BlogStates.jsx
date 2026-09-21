"use client"

import Link from "next/link"
import { AlertTriangle, FileQuestion } from "lucide-react"
import { useTranslation } from "@/lib/i18n"

function StateShell({ icon: Icon, title, text, children }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-[#0a0a0a] px-[24px] pb-[80px] pt-[130px] text-center text-white">
      <span className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-[#ff4b00]/12 text-[#ff4b00]">
        <Icon size={28} />
      </span>
      <h1 className="mt-[22px] text-[26px] font-[800] tracking-[-0.02em]">{title}</h1>
      <p className="mt-[10px] max-w-[420px] text-[14.5px] leading-[1.65] text-white/55">{text}</p>
      <div className="mt-[26px] flex flex-wrap justify-center gap-[10px]">{children}</div>
    </div>
  )
}

const primary = "rounded-full bg-[#ff4b00] px-[22px] py-[11px] text-[13px] font-[800] uppercase tracking-[0.02em] text-white transition hover:brightness-110"

export function BlogNotFound() {
  const { t } = useTranslation()
  return (
    <StateShell icon={FileQuestion} title={t("blog.notFoundTitle")} text={t("blog.notFoundText")}>
      <Link href="/blog" className={primary}>
        {t("blog.backToBlog")}
      </Link>
    </StateShell>
  )
}

export function BlogError({ reset }) {
  const { t } = useTranslation()
  return (
    <StateShell icon={AlertTriangle} title={t("blog.errorTitle")} text={t("blog.errorText")}>
      <button type="button" onClick={reset} className={primary}>
        {t("blog.retry")}
      </button>
      <Link href="/blog" className="rounded-full border border-white/20 px-[22px] py-[11px] text-[13px] font-[700] text-white transition-colors hover:bg-white/[0.07]">
        {t("blog.backToBlog")}
      </Link>
    </StateShell>
  )
}
