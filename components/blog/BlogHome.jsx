"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, FileText, Search, SearchX, X } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { PostCard, FeaturedCard } from "./PostCard"
import { PostGridSkeleton } from "./BlogSkeletons"
import "./blog.css"

// Filters live in the URL (?q=&category=&tag=&page=) so any filtered view can
// be shared or bookmarked, and the server renders exactly what the URL says.
export function blogHref({ q = "", category = "", tag = "", page = 1 } = {}) {
  const sp = new URLSearchParams()
  if (q) sp.set("q", q)
  if (category) sp.set("category", category)
  if (tag) sp.set("tag", tag)
  if (page > 1) sp.set("page", String(page))
  const qs = sp.toString()
  return qs ? `/blog?${qs}` : "/blog"
}

function Pagination({ page, pages, filters }) {
  const { t } = useTranslation()
  if (pages <= 1) return null
  const numbers = []
  for (let n = Math.max(1, page - 2); n <= Math.min(pages, page + 2); n++) numbers.push(n)
  const base = "flex h-[42px] min-w-[42px] items-center justify-center rounded-full border px-[12px] text-[13px] font-[700] transition-colors focus-visible:outline-2 focus-visible:outline-[#ff4b00]"
  return (
    <nav aria-label={t("blog.pagination")} className="mt-[48px] flex flex-wrap items-center justify-center gap-[8px]">
      {page > 1 ? (
        <Link href={blogHref({ ...filters, page: page - 1 })} className={`${base} gap-[6px] border-white/15 text-white/80 hover:border-white/35 hover:text-white`} rel="prev">
          <ChevronLeft size={16} />
          <span className="hidden sm:inline">{t("blog.previous")}</span>
        </Link>
      ) : null}
      {numbers.map((n) => (
        <Link
          key={n}
          href={blogHref({ ...filters, page: n })}
          aria-current={n === page ? "page" : undefined}
          className={`${base} ${n === page ? "border-[#ff4b00] bg-[#ff4b00] text-white" : "border-white/15 text-white/70 hover:border-white/35 hover:text-white"}`}
        >
          {n}
        </Link>
      ))}
      {page < pages ? (
        <Link href={blogHref({ ...filters, page: page + 1 })} className={`${base} gap-[6px] border-white/15 text-white/80 hover:border-white/35 hover:text-white`} rel="next">
          <span className="hidden sm:inline">{t("blog.next")}</span>
          <ChevronRight size={16} />
        </Link>
      ) : null}
    </nav>
  )
}

function EmptyState({ filtered }) {
  const { t } = useTranslation()
  const Icon = filtered ? SearchX : FileText
  return (
    <div className="mx-auto flex max-w-[460px] flex-col items-center rounded-[20px] border border-dashed border-white/12 px-[24px] py-[56px] text-center">
      <span className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-[#ff4b00]/12 text-[#ff4b00]">
        <Icon size={24} />
      </span>
      <h2 className="mt-[18px] text-[20px] font-[800] text-white">{filtered ? t("blog.noResultsTitle") : t("blog.emptyTitle")}</h2>
      <p className="mt-[8px] text-[14px] leading-[1.6] text-white/55">{filtered ? t("blog.noResultsText") : t("blog.emptyText")}</p>
      {filtered && (
        <Link
          href={blogHref({})}
          className="mt-[20px] rounded-full border border-white/20 px-[18px] py-[10px] text-[13px] font-[700] text-white transition-colors hover:bg-white/[0.07]"
        >
          {t("blog.clearFilters")}
        </Link>
      )}
    </div>
  )
}

export default function BlogHome({ featured, posts, total, page, pages, categories, tags, filters }) {
  const { t } = useTranslation()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState(filters.q)
  const lastPushed = useRef(filters.q)

  // Keep the box in step when the URL changes from outside (Clear filters, back button).
  useEffect(() => {
    setQuery(filters.q)
    lastPushed.current = filters.q
  }, [filters.q])

  // Debounced search: wait for a pause in typing, then update the URL.
  useEffect(() => {
    const next = query.trim()
    if (next === lastPushed.current) return
    const timer = setTimeout(() => {
      lastPushed.current = next
      startTransition(() => router.replace(blogHref({ ...filters, q: next, page: 1 }), { scroll: false }))
    }, 350)
    return () => clearTimeout(timer)
  }, [query, filters, router])

  const filtered = Boolean(filters.q || filters.category || filters.tag)
  const showFeatured = !filtered && page === 1 && featured
  const activeCategory = categories.find((c) => c.slug === filters.category)
  const activeTag = tags.find((tg) => tg.slug === filters.tag)

  const chip =
    "inline-flex items-center gap-[6px] rounded-full border px-[15px] py-[8px] text-[13px] font-[600] transition-colors focus-visible:outline-2 focus-visible:outline-[#ff4b00]"
  const chipOff = "border-white/12 text-white/70 hover:border-white/30 hover:text-white"
  const chipOn = "border-[#ff4b00] bg-[#ff4b00] text-white"

  return (
    <div className="bg-[#0a0a0a] pb-[90px] text-white">
      <section className="relative overflow-hidden pt-[124px] sm:pt-[140px]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-[180px] left-1/2 h-[420px] w-[820px] max-w-[140%] -translate-x-1/2 rounded-full bg-[#ff4b00]/[0.13] blur-[110px]"
        />
        <div className="relative mx-auto max-w-[1240px] px-[20px] sm:px-[32px]">
          <span className="inline-flex items-center gap-[8px] rounded-full border border-white/12 px-[14px] py-[6px] text-[11px] font-[800] uppercase tracking-[0.1em] text-white/70">
            <span className="h-[6px] w-[6px] rounded-full bg-[#ff4b00]" aria-hidden="true" />
            {t("blog.navLabel")}
          </span>
          <h1 className="blog-fade-up mt-[20px] max-w-[860px] text-[clamp(34px,6vw,64px)] font-[800] leading-[1.04] tracking-[-0.035em]">
            {t("blog.heroTitle")}
          </h1>
          <p className="mt-[16px] max-w-[600px] text-[16px] leading-[1.7] text-white/60">{t("blog.heroSubtitle")}</p>

          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault()
              lastPushed.current = query.trim()
              startTransition(() => router.replace(blogHref({ ...filters, q: query.trim(), page: 1 }), { scroll: false }))
            }}
            className="mt-[28px] flex max-w-[600px] items-center gap-[12px] rounded-full border border-white/15 bg-white/[0.04] px-[20px] py-[4px] transition-colors focus-within:border-[#ff4b00]"
          >
            <Search size={18} className="shrink-0 text-white/40" aria-hidden="true" />
            <label htmlFor="blog-search" className="sr-only">
              {t("blog.searchLabel")}
            </label>
            <input
              id="blog-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("blog.searchPlaceholder")}
              autoComplete="off"
              maxLength={80}
              className="h-[46px] w-full bg-transparent text-[15px] text-white placeholder-white/35 outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {isPending && <span className="h-[16px] w-[16px] shrink-0 animate-spin rounded-full border-2 border-white/20 border-t-[#ff4b00]" aria-hidden="true" />}
            {query && !isPending && (
              <button type="button" onClick={() => setQuery("")} aria-label={t("blog.clearSearch")} className="shrink-0 text-white/40 transition-colors hover:text-white">
                <X size={16} />
              </button>
            )}
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-[1240px] px-[20px] sm:px-[32px]">
        {categories.length > 0 && (
          <nav aria-label={t("blog.categoriesLabel")} className="mt-[32px] flex flex-wrap gap-[8px]">
            <Link href={blogHref({ q: filters.q })} className={`${chip} ${!filters.category ? chipOn : chipOff}`} aria-current={!filters.category ? "true" : undefined}>
              {t("blog.allCategories")}
            </Link>
            {categories.map((c) => (
              <Link
                key={c._id}
                href={blogHref({ q: filters.q, category: c.slug })}
                className={`${chip} ${filters.category === c.slug ? chipOn : chipOff}`}
                aria-current={filters.category === c.slug ? "true" : undefined}
              >
                {c.name}
                <span className="text-[11px] opacity-60">{c.count}</span>
              </Link>
            ))}
          </nav>
        )}

        {tags.length > 0 && (
          <div className="mt-[14px] flex flex-wrap items-center gap-x-[14px] gap-y-[8px] text-[13px]">
            <span className="text-white/40">{t("blog.popularTags")}</span>
            {tags.map((tg) => (
              <Link
                key={tg.slug}
                href={blogHref({ ...filters, tag: filters.tag === tg.slug ? "" : tg.slug, page: 1 })}
                className={`transition-colors ${filters.tag === tg.slug ? "font-[700] text-[#ff4b00]" : "text-white/60 hover:text-white"}`}
              >
                #{tg.name}
              </Link>
            ))}
          </div>
        )}

        {filtered && (
          <div className="mt-[26px] flex flex-wrap items-center gap-[10px] text-[14px] text-white/60" aria-live="polite">
            <span>
              {filters.q ? t("blog.resultsFor", { n: total, q: filters.q }) : t("blog.resultsCount", { n: total })}
              {activeCategory ? ` · ${activeCategory.name}` : ""}
              {filters.tag ? ` · #${activeTag?.name || filters.tag}` : ""}
            </span>
            <Link href={blogHref({})} className="inline-flex items-center gap-[5px] rounded-full border border-white/15 px-[12px] py-[4px] text-[12px] font-[700] text-white/80 transition-colors hover:bg-white/[0.07]">
              <X size={12} />
              {t("blog.clearFilters")}
            </Link>
          </div>
        )}

        {showFeatured && (
          <section className="mt-[36px]" aria-label={t("blog.featured")}>
            <FeaturedCard post={featured} />
          </section>
        )}

        <section className="mt-[52px]" aria-label={t("blog.latest")}>
          {!filtered && posts.length > 0 && <h2 className="mb-[22px] text-[22px] font-[800] tracking-[-0.02em] sm:text-[26px]">{t("blog.latest")}</h2>}
          {isPending ? (
            <PostGridSkeleton />
          ) : posts.length === 0 && !showFeatured ? (
            <EmptyState filtered={filtered} />
          ) : (
            <>
              <div className="grid gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((post, i) => (
                  <PostCard key={post._id} post={post} variant={i === 0 && posts.length >= 3 && page === 1 ? "wide" : "default"} priority={i < 2} />
                ))}
              </div>
              <Pagination page={page} pages={pages} filters={filters} />
            </>
          )}
        </section>
      </div>
    </div>
  )
}
