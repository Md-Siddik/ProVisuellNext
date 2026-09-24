"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, FileText, Search, SearchX, X } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { PostCard, FeaturedCard } from "./PostCard"
import { PostGridSkeleton } from "./BlogSkeletons"
import BlogAd from "./BlogAd"
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
    "inline-flex shrink-0 items-center gap-[6px] rounded-full border px-[15px] py-[8px] text-[13px] font-[600] transition-colors focus-visible:outline-2 focus-visible:outline-[#ff4b00]"
  const chipOff = "border-white/12 text-white/70 hover:border-white/30 hover:text-white"
  const chipOn = "border-[#ff4b00] bg-[#ff4b00] text-white"

  const tagLinks = tags.map((tg) => (
    <Link
      key={tg.slug}
      href={blogHref({ ...filters, tag: filters.tag === tg.slug ? "" : tg.slug, page: 1 })}
      aria-current={filters.tag === tg.slug ? "true" : undefined}
      className={`rounded-full border px-[11px] py-[5px] text-[12.5px] font-[600] transition-colors ${
        filters.tag === tg.slug ? "border-[#ff4b00] text-[#ff4b00]" : "border-white/10 text-white/60 hover:border-white/30 hover:text-white"
      }`}
    >
      #{tg.name}
    </Link>
  ))

  const panel = "rounded-[18px] border border-white/[0.09] bg-[#111212] p-[20px]"
  const panelTitle = "mb-[14px] text-[11px] font-[800] uppercase tracking-[0.12em] text-white/45"

  return (
    <div className="bg-[#0a0a0a] pb-[96px] text-white">
      <section className="relative overflow-hidden border-b border-white/[0.07] pb-[48px] pt-[124px] sm:pb-[56px] sm:pt-[144px]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-[200px] left-1/2 h-[420px] w-[820px] max-w-[140%] -translate-x-1/2 rounded-full bg-[#ff4b00]/[0.12] blur-[120px]"
        />
        <div className="relative mx-auto max-w-[1240px] px-[20px] sm:px-[32px]">
          <span className="inline-flex items-center gap-[8px] rounded-full border border-white/12 bg-white/[0.03] px-[14px] py-[6px] text-[11px] font-[800] uppercase tracking-[0.12em] text-white/70">
            <span className="h-[6px] w-[6px] rounded-full bg-[#ff4b00]" aria-hidden="true" />
            {t("blog.navLabel")}
          </span>
          <div className="mt-[20px] flex flex-col gap-[28px] lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[720px]">
              <h1 className="blog-fade-up text-[clamp(34px,5.4vw,60px)] font-[800] leading-[1.04] tracking-[-0.035em]">{t("blog.heroTitle")}</h1>
              <p className="mt-[16px] max-w-[580px] text-[16px] leading-[1.7] text-white/60">{t("blog.heroSubtitle")}</p>
            </div>

            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault()
                lastPushed.current = query.trim()
                startTransition(() => router.replace(blogHref({ ...filters, q: query.trim(), page: 1 }), { scroll: false }))
              }}
              className="flex w-full items-center gap-[12px] rounded-[14px] border border-white/15 bg-[#111212] px-[18px] py-[4px] shadow-[0_10px_40px_rgba(0,0,0,0.35)] transition-colors focus-within:border-[#ff4b00] lg:max-w-[400px]"
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
                className="h-[48px] w-full bg-transparent text-[15px] text-white placeholder-white/35 outline-none [&::-webkit-search-cancel-button]:hidden"
              />
              {isPending && <span className="h-[16px] w-[16px] shrink-0 animate-spin rounded-full border-2 border-white/20 border-t-[#ff4b00]" aria-hidden="true" />}
              {query && !isPending && (
                <button type="button" onClick={() => setQuery("")} aria-label={t("blog.clearSearch")} className="shrink-0 text-white/40 transition-colors hover:text-white">
                  <X size={16} />
                </button>
              )}
            </form>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1240px] gap-[48px] px-[20px] pt-[36px] sm:px-[32px] lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {/* Below lg the sidebar is hidden, so categories and tags sit above the posts. */}
          {categories.length > 0 && (
            <nav
              aria-label={t("blog.categoriesLabel")}
              className="-mx-[20px] flex gap-[8px] overflow-x-auto px-[20px] pb-[4px] [scrollbar-width:none] sm:-mx-[32px] sm:px-[32px] lg:hidden"
            >
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
          {tags.length > 0 && <div className="mt-[14px] flex flex-wrap gap-[8px] lg:hidden">{tagLinks}</div>}

          {filtered && (
            <div
              className="mt-[26px] flex flex-wrap items-center justify-between gap-[10px] rounded-[14px] border border-white/[0.09] bg-white/[0.02] px-[16px] py-[12px] text-[14px] text-white/65 lg:mt-0"
              aria-live="polite"
            >
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
            <section className="mt-[28px] lg:mt-0" aria-label={t("blog.featured")}>
              <FeaturedCard post={featured} />
            </section>
          )}

          <BlogAd slot="house" className="mt-[32px] sm:max-w-[420px] lg:hidden" />

          <section className="mt-[48px]" aria-labelledby="blog-latest">
            {!filtered && posts.length > 0 && (
              <div className="mb-[24px] flex items-center gap-[16px]">
                <h2 id="blog-latest" className="shrink-0 text-[22px] font-[800] tracking-[-0.02em] sm:text-[26px]">
                  {t("blog.latest")}
                </h2>
                <span className="h-px flex-1 bg-white/[0.09]" aria-hidden="true" />
                <span className="shrink-0 text-[13px] text-white/45">{t("blog.resultsCount", { n: total })}</span>
              </div>
            )}
            {isPending ? (
              <PostGridSkeleton />
            ) : posts.length === 0 && !showFeatured ? (
              <EmptyState filtered={filtered} />
            ) : (
              <>
                <div className="grid gap-[22px] sm:grid-cols-2">
                  {posts.map((post, i) => (
                    <PostCard key={post._id} post={post} variant={i === 0 && posts.length >= 3 && page === 1 ? "wide" : "default"} priority={i < 2} />
                  ))}
                </div>
                <Pagination page={page} pages={pages} filters={filters} />
              </>
            )}
          </section>

          <BlogAd slot="partner" className="mt-[48px] sm:max-w-[420px] lg:hidden" />
        </div>

        <aside className="hidden lg:block" aria-label={t("blog.sidebarLabel")}>
          <div className="flex h-full flex-col gap-[20px]">
            <BlogAd slot="house" />

            {categories.length > 0 && (
              <nav aria-label={t("blog.categoriesLabel")} className={panel}>
                <h2 className={panelTitle}>{t("blog.categoriesLabel")}</h2>
                <ul className="-mx-[8px]">
                  {[{ _id: "all", slug: "", name: t("blog.allCategories"), count: null }, ...categories].map((c) => {
                    const active = (filters.category || "") === c.slug
                    return (
                      <li key={c._id}>
                        <Link
                          href={blogHref({ q: filters.q, category: c.slug })}
                          aria-current={active ? "true" : undefined}
                          className={`flex items-center justify-between rounded-[10px] px-[10px] py-[8px] text-[14px] transition-colors ${
                            active ? "bg-[#ff4b00]/12 font-[700] text-[#ff4b00]" : "text-white/70 hover:bg-white/[0.05] hover:text-white"
                          }`}
                        >
                          <span className="truncate">{c.name}</span>
                          {c.count != null && <span className={`text-[12px] tabular-nums ${active ? "text-[#ff4b00]" : "text-white/35"}`}>{c.count}</span>}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </nav>
            )}

            {tags.length > 0 && (
              <div className={panel}>
                <h2 className={panelTitle}>{t("blog.popularTags")}</h2>
                <div className="flex flex-wrap gap-[8px]">{tagLinks}</div>
              </div>
            )}

            <BlogAd slot="partner" className="sticky top-[110px]" />
          </div>
        </aside>
      </div>
    </div>
  )
}
