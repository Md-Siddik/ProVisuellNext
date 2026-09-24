"use client"

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { BLOG_ADS } from "@/lib/blog/ads"

// One ad slot: "house" (ProVisuell's own ad) or "partner" (a suggested
// partner company). What each slot shows is configured in lib/blog/ads.js.
export default function BlogAd({ slot = "house", className = "" }) {
  const { t } = useTranslation()
  const ad = BLOG_ADS[slot]
  if (!ad) return null

  const text = (v) => (v && typeof v === "object" ? t(v.t) : v || "")
  const external = /^https?:\/\//.test(ad.href)
  const label = slot === "partner" ? t("blog.partnerLabel") : t("blog.adLabel")
  const linkProps = external ? { target: "_blank", rel: "sponsored noopener noreferrer" } : {}
  const Anchor = external ? "a" : Link

  return (
    <aside aria-label={label} className={className}>
      <Anchor
        href={ad.href}
        {...linkProps}
        className="group relative isolate flex flex-col overflow-hidden rounded-[18px] border border-white/[0.09] bg-[#111212] transition-colors hover:border-white/25 focus-visible:outline-2 focus-visible:outline-[#ff4b00]"
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-[#0d0e0e]">
          {ad.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ad.image}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#111212] via-transparent to-transparent" />
          <span className="absolute left-[12px] top-[12px] rounded-full bg-black/70 px-[9px] py-[4px] text-[10px] font-[800] uppercase tracking-[0.1em] text-white/80 backdrop-blur-sm">
            {label}
          </span>
        </div>
        <div className="flex flex-1 flex-col p-[18px] pt-[6px]">
          <span className="text-[11px] font-[800] uppercase tracking-[0.08em] text-[#ff4b00]">{ad.advertiser}</span>
          <p className="mt-[6px] text-[17px] font-[800] leading-[1.3] tracking-[-0.01em] text-white">{text(ad.title)}</p>
          <p className="mt-[8px] text-[13.5px] leading-[1.6] text-white/60">{text(ad.text)}</p>
          <span className="mt-[16px] inline-flex items-center gap-[6px] self-start rounded-full bg-[#ff4b00] px-[15px] py-[8px] text-[12.5px] font-[800] text-white transition group-hover:brightness-110">
            {text(ad.cta)}
            <ArrowUpRight size={14} aria-hidden="true" />
          </span>
        </div>
      </Anchor>
    </aside>
  )
}
