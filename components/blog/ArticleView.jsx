"use client"

import Link from "next/link"
import { ArrowLeft, ArrowRight, MessageCircle } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { Avatar, formatDate, toEmbedUrl } from "./blogUi"
import { PostCard } from "./PostCard"
import LikeButton from "./LikeButton"
import ShareMenu from "./ShareMenu"
import Comments from "./Comments"
import "./blog.css"

const DAY = 24 * 60 * 60 * 1000

function CoverMedia({ post }) {
  const embed = post.featuredVideo ? toEmbedUrl(post.featuredVideo) : null
  if (embed) {
    return (
      <iframe
        src={embed}
        title={post.title}
        loading="lazy"
        allowFullScreen
        className="aspect-video w-full rounded-[20px] border-0 bg-black"
      />
    )
  }
  if (post.featuredVideo) {
    // Nothing is downloaded until the visitor presses play (preload="none").
    return (
      <video controls playsInline preload="none" poster={post.coverImage || undefined} className="aspect-video w-full rounded-[20px] bg-black object-cover">
        <source src={post.featuredVideo} />
      </video>
    )
  }
  if (post.coverImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={post.coverImage} alt={post.coverImageAlt || ""} loading="eager" className="max-h-[620px] w-full rounded-[20px] object-cover" />
    )
  }
  return null
}

export default function ArticleView({ post, related, neighbors }) {
  const { t } = useTranslation()
  const path = `/blog/${post.slug}`
  const updated =
    post.updatedAt && post.publishedAt && new Date(post.updatedAt).getTime() - new Date(post.publishedAt).getTime() > DAY

  return (
    <article className="bg-[#0a0a0a] pb-[90px] pt-[112px] text-white sm:pt-[128px]">
      <header className="mx-auto max-w-[820px] px-[20px] sm:px-[32px]">
        <Link href="/blog" className="inline-flex items-center gap-[7px] text-[13px] font-[700] text-white/55 transition-colors hover:text-white">
          <ArrowLeft size={15} />
          {t("blog.backToBlog")}
        </Link>

        <div className="mt-[26px] flex flex-wrap items-center gap-x-[14px] gap-y-[6px] text-[12px] font-[800] uppercase tracking-[0.08em]">
          {post.category && (
            <Link href={`/blog?category=${post.category.slug}`} className="text-[#ff4b00] hover:underline">
              {post.category.name}
            </Link>
          )}
          <span className="font-[600] normal-case tracking-normal text-white/45">{t("blog.minRead", { n: post.readingTime })}</span>
        </div>

        <h1 className="blog-fade-up mt-[14px] text-[clamp(30px,5vw,52px)] font-[800] leading-[1.08] tracking-[-0.03em]">{post.title}</h1>
        {post.excerpt && <p className="mt-[18px] text-[18px] leading-[1.65] text-white/62">{post.excerpt}</p>}

        <div className="mt-[26px] flex flex-wrap items-center justify-between gap-[16px] border-y border-white/[0.09] py-[16px]">
          <div className="flex items-center gap-[12px]">
            <Avatar name={post.author.name} src={post.author.avatar} size={42} />
            <div className="leading-tight">
              <p className="text-[14px] font-[700] text-white">{post.author.name}</p>
              <p className="mt-[3px] text-[12px] text-white/50">
                <time dateTime={post.publishedAt || undefined}>{formatDate(post.publishedAt)}</time>
                {updated && (
                  <>
                    <span className="mx-[6px] text-white/25" aria-hidden="true">
                      ·
                    </span>
                    {t("blog.updatedOn", { date: formatDate(post.updatedAt) })}
                  </>
                )}
              </p>
            </div>
          </div>
          <ShareMenu path={path} title={post.title} align="right" direction="down" />
        </div>
      </header>

      {(post.featuredVideo || post.coverImage) && (
        <div className="mx-auto mt-[34px] max-w-[1080px] px-[20px] sm:px-[32px]">
          <CoverMedia post={post} />
        </div>
      )}

      <div className="mx-auto mt-[44px] max-w-[720px] px-[20px] sm:px-[32px]">
        {/* Sanitised on the server both when saved and again before this page renders. */}
        <div className="blog-prose" dangerouslySetInnerHTML={{ __html: post.content }} />

        {post.tags.length > 0 && (
          <ul className="mt-[40px] flex flex-wrap gap-[8px]" aria-label={t("blog.tagsLabel")}>
            {post.tags.map((tag) => (
              <li key={tag}>
                <Link
                  href={`/blog?tag=${encodeURIComponent(tag)}`}
                  className="inline-block rounded-full border border-white/12 px-[13px] py-[6px] text-[12.5px] font-[600] text-white/65 transition-colors hover:border-[#ff4b00]/60 hover:text-white"
                >
                  #{tag}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-[36px] flex flex-wrap items-center justify-between gap-[12px] rounded-[16px] border border-white/10 bg-white/[0.03] p-[14px] sm:px-[18px]">
          <div className="flex flex-wrap items-center gap-[10px]">
            <LikeButton postId={post._id} initialCount={post.likeCount} />
            <a
              href="#comments"
              className="inline-flex h-[40px] items-center gap-[8px] rounded-full border border-white/15 px-[16px] text-[13px] font-[700] text-white/85 transition-colors hover:border-white/35 hover:text-white"
            >
              <MessageCircle size={16} />
              {t("blog.commentCountLabel", { n: post.commentCount })}
            </a>
          </div>
          <ShareMenu path={path} title={post.title} align="right" />
        </div>

        {(neighbors.previous || neighbors.next) && (
          <nav aria-label={t("blog.moreArticles")} className="mt-[40px] grid gap-[14px] sm:grid-cols-2">
            {neighbors.previous ? (
              <Link href={`/blog/${neighbors.previous.slug}`} className="group rounded-[14px] border border-white/10 p-[16px] transition-colors hover:border-white/25">
                <span className="flex items-center gap-[6px] text-[11.5px] font-[700] uppercase tracking-[0.06em] text-white/40">
                  <ArrowLeft size={13} />
                  {t("blog.prevPost")}
                </span>
                <span className="mt-[6px] line-clamp-2 block text-[14.5px] font-[700] leading-[1.35] text-white group-hover:text-[#ff4b00]">{neighbors.previous.title}</span>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
            {neighbors.next && (
              <Link href={`/blog/${neighbors.next.slug}`} className="group rounded-[14px] border border-white/10 p-[16px] text-right transition-colors hover:border-white/25">
                <span className="flex items-center justify-end gap-[6px] text-[11.5px] font-[700] uppercase tracking-[0.06em] text-white/40">
                  {t("blog.nextPost")}
                  <ArrowRight size={13} />
                </span>
                <span className="mt-[6px] line-clamp-2 block text-[14.5px] font-[700] leading-[1.35] text-white group-hover:text-[#ff4b00]">{neighbors.next.title}</span>
              </Link>
            )}
          </nav>
        )}

        <div className="mt-[56px]">
          <Comments postId={post._id} initialCount={post.commentCount} />
        </div>
      </div>

      {related.length > 0 && (
        <section className="mx-auto mt-[88px] max-w-[1240px] px-[20px] sm:px-[32px]" aria-labelledby="related-title">
          <h2 id="related-title" className="text-[24px] font-[800] tracking-[-0.02em] sm:text-[28px]">
            {t("blog.relatedTitle")}
          </h2>
          <div className="mt-[24px] grid gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <PostCard key={p._id} post={p} />
            ))}
          </div>
        </section>
      )}
    </article>
  )
}
