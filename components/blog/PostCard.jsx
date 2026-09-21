"use client"

import Link from "next/link"
import { ArrowRight, Heart, MessageCircle, Play } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { Avatar, CoverFallback, formatDate } from "./blogUi"
import ShareMenu from "./ShareMenu"

function VideoBadge({ label }) {
  return (
    <span className="absolute left-[12px] top-[12px] z-[1] inline-flex items-center gap-[6px] rounded-full bg-black/65 px-[10px] py-[5px] text-[11px] font-[700] uppercase tracking-[0.04em] text-white backdrop-blur-sm">
      <Play size={11} fill="currentColor" />
      {label}
    </span>
  )
}

function Counters({ post, className = "" }) {
  const { t } = useTranslation()
  return (
    <div className={`flex items-center gap-[14px] text-[12px] text-white/50 ${className}`}>
      <span className="inline-flex items-center gap-[5px]" title={t("blog.likeCountLabel", { n: post.likeCount })}>
        <Heart size={13} aria-hidden="true" />
        <span aria-label={t("blog.likeCountLabel", { n: post.likeCount })}>{post.likeCount}</span>
      </span>
      <span className="inline-flex items-center gap-[5px]" title={t("blog.commentCountLabel", { n: post.commentCount })}>
        <MessageCircle size={13} aria-hidden="true" />
        <span aria-label={t("blog.commentCountLabel", { n: post.commentCount })}>{post.commentCount}</span>
      </span>
    </div>
  )
}

function Meta({ post }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-[10px] text-[12px] text-white/55">
      <Avatar name={post.author.name} src={post.author.avatar} size={24} />
      <span className="min-w-0 truncate">
        <span className="font-[600] text-white/80">{post.author.name}</span>
        <span className="mx-[6px] text-white/25" aria-hidden="true">
          ·
        </span>
        <time dateTime={post.publishedAt || undefined}>{formatDate(post.publishedAt, { day: "numeric", month: "short", year: "numeric" })}</time>
        <span className="mx-[6px] text-white/25" aria-hidden="true">
          ·
        </span>
        {t("blog.minRead", { n: post.readingTime })}
      </span>
    </div>
  )
}

// The whole card is one link (the title's stretched ::after); the share
// button sits above it so it stays independently clickable.
export function PostCard({ post, variant = "default", priority = false }) {
  const { t } = useTranslation()
  const href = `/blog/${post.slug}`

  if (variant === "wide") {
    return (
      <article className="group relative isolate flex min-h-[340px] flex-col justify-end overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#111212] transition duration-300 hover:border-white/20 sm:col-span-2 lg:min-h-[420px]">
        {post.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImage}
            alt={post.coverImageAlt || ""}
            loading={priority ? "eager" : "lazy"}
            className="absolute inset-0 -z-10 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <CoverFallback title={post.title} className="absolute inset-0 -z-10" />
        )}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
        {post.hasVideo && <VideoBadge label={t("blog.video")} />}
        <div className="absolute right-[14px] top-[14px] z-10">
          <ShareMenu variant="icon" direction="down" path={href} title={post.title} />
        </div>
        <div className="p-[22px] sm:p-[30px]">
          {post.category && (
            <span className="mb-[10px] inline-block text-[11px] font-[800] uppercase tracking-[0.08em] text-[#ff4b00]">{post.category.name}</span>
          )}
          <h3 className="max-w-[640px] text-[24px] font-[800] leading-[1.15] tracking-[-0.02em] text-white sm:text-[30px]">
            <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
              {post.title}
            </Link>
          </h3>
          {post.excerpt && <p className="mt-[10px] line-clamp-2 max-w-[600px] text-[14px] leading-[1.6] text-white/70">{post.excerpt}</p>}
          <div className="mt-[16px] flex flex-wrap items-center justify-between gap-[10px]">
            <Meta post={post} />
            <Counters post={post} />
          </div>
        </div>
      </article>
    )
  }

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#111212] transition duration-300 focus-within:border-white/25 hover:-translate-y-[3px] hover:border-white/20 hover:shadow-[0_18px_50px_rgba(0,0,0,0.5)]">
      <div className="relative aspect-[16/10] overflow-hidden bg-[#0d0e0e]">
        {post.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImage}
            alt={post.coverImageAlt || ""}
            loading={priority ? "eager" : "lazy"}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
          />
        ) : (
          <CoverFallback title={post.title} className="h-full w-full" />
        )}
        {post.hasVideo && <VideoBadge label={t("blog.video")} />}
      </div>
      <div className="absolute right-[12px] top-[12px] z-10">
        <ShareMenu variant="icon" direction="down" path={href} title={post.title} />
      </div>
      <div className="flex flex-1 flex-col p-[20px]">
        {post.category && (
          <span className="mb-[8px] text-[11px] font-[800] uppercase tracking-[0.08em] text-[#ff4b00]">{post.category.name}</span>
        )}
        <h3 className="text-[18px] font-[800] leading-[1.3] tracking-[-0.01em] text-white">
          <Link href={href} className="line-clamp-2 after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {post.title}
          </Link>
        </h3>
        {post.excerpt && <p className="mt-[8px] line-clamp-3 text-[13.5px] leading-[1.6] text-white/60">{post.excerpt}</p>}
        <div className="mt-auto flex flex-col gap-[12px] pt-[16px]">
          <Meta post={post} />
          <Counters post={post} className="border-t border-white/[0.07] pt-[12px]" />
        </div>
      </div>
    </article>
  )
}

// The large hero card at the top of /blog.
export function FeaturedCard({ post }) {
  const { t } = useTranslation()
  const href = `/blog/${post.slug}`
  return (
    <article className="group relative grid overflow-hidden rounded-[24px] border border-white/[0.09] bg-[#111212] transition duration-300 hover:border-white/20 lg:grid-cols-[1.25fr_1fr]">
      <div className="relative aspect-[16/10] overflow-hidden bg-[#0d0e0e] lg:aspect-auto lg:min-h-[440px]">
        {post.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImage}
            alt={post.coverImageAlt || ""}
            loading="eager"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] group-hover:scale-[1.035]"
          />
        ) : (
          <CoverFallback title={post.title} className="absolute inset-0" />
        )}
        {post.hasVideo && <VideoBadge label={t("blog.video")} />}
      </div>
      <div className="flex flex-col justify-center p-[24px] sm:p-[36px] lg:p-[44px]">
        <div className="mb-[14px] flex flex-wrap items-center gap-[10px]">
          <span className="rounded-full bg-[#ff4b00] px-[11px] py-[4px] text-[10.5px] font-[800] uppercase tracking-[0.08em] text-white">{t("blog.featured")}</span>
          {post.category && <span className="text-[11px] font-[800] uppercase tracking-[0.08em] text-[#ff4b00]">{post.category.name}</span>}
        </div>
        <h2 className="text-[28px] font-[800] leading-[1.12] tracking-[-0.025em] text-white sm:text-[36px] lg:text-[40px]">
          <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {post.title}
          </Link>
        </h2>
        {post.excerpt && <p className="mt-[14px] line-clamp-4 text-[15px] leading-[1.7] text-white/65">{post.excerpt}</p>}
        <div className="mt-[22px]">
          <Meta post={post} />
        </div>
        <div className="mt-[24px] flex flex-wrap items-center justify-between gap-[14px]">
          <span className="inline-flex items-center gap-[8px] text-[13px] font-[800] uppercase tracking-[0.03em] text-[#ff4b00] transition-[gap] duration-300 group-hover:gap-[13px]">
            {t("blog.readMore")}
            <ArrowRight size={16} />
          </span>
          <Counters post={post} />
        </div>
      </div>
      <div className="absolute right-[16px] top-[16px] z-10">
        <ShareMenu variant="icon" direction="down" path={href} title={post.title} />
      </div>
    </article>
  )
}
