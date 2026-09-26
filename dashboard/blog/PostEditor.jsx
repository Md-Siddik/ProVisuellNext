"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, Eye, ImagePlus, Save, Send, Trash2, Upload, X } from "lucide-react"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { useAuth } from "@/context/AuthContext"
import { toEmbedUrl } from "@/components/blog/blogUi"
import "@/components/blog/blog.css"
import RichTextEditor from "./RichTextEditor"
import { checkMediaFile, uploadBlogMedia } from "./media"
import { Card, ErrorNote, LoadingBlock, Spinner, btnGhost, btnPrimary, inputClass, isConflict } from "./adminUi"

const EMPTY = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  coverImage: "",
  coverImageAlt: "",
  featuredVideo: "",
  category: "",
  tags: [],
  status: "draft",
  featured: false,
  seoTitle: "",
  seoDescription: "",
  scheduledAt: "",
}

// The server does the real slugging (and uniqueness); this only mirrors it
// for the live "/blog/…" preview while typing a title.
function previewSlug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
}

// <input type="datetime-local"> works in local time; the API stores ISO.
const toLocalInput = (iso) => {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function Field({ label, hint, children, htmlFor }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-[6px] block text-[12px] font-[700] text-white/70">
        {label}
      </label>
      {children}
      {hint && <p className="mt-[5px] text-[11.5px] text-white/40">{hint}</p>}
    </div>
  )
}

function PreviewModal({ form, categoryName, onClose }) {
  const { t } = useTranslation()
  const embed = form.featuredVideo ? toEmbedUrl(form.featuredVideo) : null
  return (
    <div className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-black/80 p-[16px] sm:p-[32px]" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={t("blogAdmin.editor.preview")} className="w-full max-w-[860px] rounded-[16px] border border-white/10 bg-[#0a0a0a]" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-[16px] border-b border-white/10 bg-[#0a0a0a]/95 px-[18px] py-[12px] backdrop-blur">
          <span className="text-[12px] font-[800] uppercase tracking-[0.08em] text-[#ff4b00]">{t("blogAdmin.editor.preview")}</span>
          <button type="button" onClick={onClose} aria-label={t("blog.cancel")} className="text-white/60 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="px-[20px] pb-[40px] pt-[28px] sm:px-[40px]">
          {categoryName && <p className="text-[12px] font-[800] uppercase tracking-[0.08em] text-[#ff4b00]">{categoryName}</p>}
          <h1 className="mt-[8px] text-[clamp(28px,4vw,44px)] font-[800] leading-[1.1] tracking-[-0.03em] text-white">{form.title || t("blogAdmin.editor.untitled")}</h1>
          {form.excerpt && <p className="mt-[14px] text-[17px] leading-[1.65] text-white/60">{form.excerpt}</p>}
          {embed ? (
            <iframe src={embed} title={form.title} className="mt-[24px] aspect-video w-full rounded-[16px] border-0 bg-black" allowFullScreen />
          ) : form.featuredVideo ? (
            <video src={form.featuredVideo} poster={form.coverImage || undefined} controls preload="none" className="mt-[24px] aspect-video w-full rounded-[16px] bg-black" />
          ) : form.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.coverImage} alt={form.coverImageAlt} className="mt-[24px] max-h-[480px] w-full rounded-[16px] object-cover" />
          ) : null}
          <div className="blog-prose mt-[28px]" dangerouslySetInnerHTML={{ __html: form.content }} />
        </div>
      </div>
    </div>
  )
}

export default function PostEditor({ postId, taxonomy, onClose, onSaved, refreshTaxonomy }) {
  const { t } = useTranslation()
  const { can } = useAuth()
  const canPublish = can("blog.publish")
  const isNew = !postId
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(!isNew)
  const [loadError, setLoadError] = useState("")
  const [saving, setSaving] = useState("")
  const [error, setError] = useState("")
  const [slugError, setSlugError] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [tagInput, setTagInput] = useState("")
  const [uploading, setUploading] = useState("")
  const [previewing, setPreviewing] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [savedNotice, setSavedNotice] = useState(false)
  const idRef = useRef(postId)
  const coverInput = useRef(null)
  const videoInput = useRef(null)

  const load = useCallback(async () => {
    if (!postId) return
    setLoading(true)
    setLoadError("")
    try {
      const { post } = await api.get(`/blog/admin/posts/${postId}`)
      setForm({ ...EMPTY, ...post, scheduledAt: toLocalInput(post.scheduledAt) })
      setSlugTouched(true)
      setResetKey((k) => k + 1)
    } catch (err) {
      console.error(err)
      setLoadError(t("blogAdmin.editor.loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [postId, t])

  useEffect(() => {
    load()
  }, [load])

  // Warn before the tab is closed with unsaved work.
  useEffect(() => {
    if (!dirty) return
    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }))
    setDirty(true)
    setSavedNotice(false)
  }

  const slugShown = slugTouched ? form.slug : previewSlug(form.title)
  const categoryName = useMemo(() => taxonomy.categories.find((c) => c._id === form.category)?.name || "", [taxonomy, form.category])

  const handleClose = () => {
    if (dirty && !window.confirm(t("blogAdmin.editor.discardConfirm"))) return
    onClose()
  }

  const addTag = (raw) => {
    const name = raw.trim().replace(/^#/, "")
    if (!name) return
    if (form.tags.some((x) => x.toLowerCase() === name.toLowerCase())) {
      setTagInput("")
      return
    }
    set({ tags: [...form.tags, name] })
    setTagInput("")
  }

  const uploadTo = async (file, kind, field) => {
    const problem = checkMediaFile(file, kind)
    if (problem) {
      setError(t(problem.key, problem.vars))
      return
    }
    setUploading(field)
    setError("")
    try {
      const media = await uploadBlogMedia(file)
      set({ [field]: media.url })
    } catch (err) {
      console.error(err)
      setError(t("blogAdmin.editor.uploadFailed"))
    } finally {
      setUploading("")
    }
  }

  // Used by the rich text editor for images/videos inside the article.
  const uploadForEditor = async (file, kind) => {
    const problem = checkMediaFile(file, kind)
    if (problem) {
      const e = new Error("invalid media")
      e.uploadMessage = t(problem.key, problem.vars)
      throw e
    }
    return (await uploadBlogMedia(file)).url
  }

  const save = async (statusOverride) => {
    setError("")
    setSlugError("")
    if (!form.title.trim()) {
      setError(t("blogAdmin.editor.titleRequired"))
      return
    }
    const status = statusOverride || form.status
    if (status === "scheduled" && !form.scheduledAt) {
      setError(t("blogAdmin.editor.scheduleRequired"))
      return
    }
    setSaving(statusOverride || "save")
    const body = {
      title: form.title,
      excerpt: form.excerpt,
      content: form.content,
      coverImage: form.coverImage,
      coverImageAlt: form.coverImageAlt,
      featuredVideo: form.featuredVideo,
      category: form.category || null,
      tags: form.tags,
      status,
      featured: form.featured,
      seoTitle: form.seoTitle,
      seoDescription: form.seoDescription,
      scheduledAt: status === "scheduled" ? new Date(form.scheduledAt).toISOString() : null,
    }
    // Only send the slug once the author has chosen one; otherwise the server derives it.
    if (slugTouched && form.slug.trim()) body.slug = form.slug
    try {
      let saved
      if (idRef.current) saved = (await api.patch(`/blog/posts/${idRef.current}`, body)).post
      else {
        saved = (await api.post("/blog/posts", body)).post
        idRef.current = saved._id
      }
      setForm((f) => ({ ...f, slug: saved.slug, status: saved.status }))
      setSlugTouched(true)
      setDirty(false)
      setSavedNotice(true)
      refreshTaxonomy()
      onSaved?.(saved)
    } catch (err) {
      console.error(err)
      if (isConflict(err)) setSlugError(t("blogAdmin.editor.slugTaken"))
      else setError(t("blogAdmin.editor.saveFailed"))
    } finally {
      setSaving("")
    }
  }

  if (loading) return <LoadingBlock rows={6} />
  if (loadError) {
    return (
      <div className="space-y-[12px]">
        <ErrorNote onRetry={load}>{loadError}</ErrorNote>
        <button type="button" onClick={onClose} className={btnGhost}>
          <ArrowLeft size={15} />
          {t("blogAdmin.back")}
        </button>
      </div>
    )
  }

  const busy = Boolean(saving) || Boolean(uploading)

  return (
    <div className="space-y-[16px]">
      <div className="flex flex-wrap items-center justify-between gap-[10px]">
        <button type="button" onClick={handleClose} className={btnGhost}>
          <ArrowLeft size={15} />
          {t("blogAdmin.back")}
        </button>
        <div className="flex flex-wrap items-center gap-[8px]">
          {savedNotice && <span className="text-[12px] font-[700] text-emerald-400" role="status">{t("blogAdmin.editor.saved")}</span>}
          <button type="button" onClick={() => setPreviewing(true)} className={btnGhost}>
            <Eye size={15} />
            {t("blogAdmin.editor.preview")}
          </button>
          <button type="button" onClick={() => save("draft")} disabled={busy} className={btnGhost}>
            {saving === "draft" ? <Spinner /> : <Save size={15} />}
            {t("blogAdmin.editor.saveDraft")}
          </button>
          {!canPublish ? null : form.status !== "published" ? (
            <button type="button" onClick={() => save("published")} disabled={busy} className={btnPrimary}>
              {saving === "published" ? <Spinner /> : <Send size={15} />}
              {t("blogAdmin.editor.publish")}
            </button>
          ) : (
            <button type="button" onClick={() => save()} disabled={busy} className={btnPrimary}>
              {saving === "save" ? <Spinner /> : <Save size={15} />}
              {t("blogAdmin.editor.update")}
            </button>
          )}
        </div>
      </div>

      <ErrorNote>{error}</ErrorNote>

      <div className="grid gap-[16px] xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-[16px]">
          <Card className="space-y-[14px] p-[16px]">
            <Field label={t("blogAdmin.editor.title")} htmlFor="pe-title">
              <input id="pe-title" value={form.title} onChange={(e) => set({ title: e.target.value })} maxLength={200} placeholder={t("blogAdmin.editor.titlePlaceholder")} className={`${inputClass} !text-[17px] !font-[700]`} />
            </Field>
            <Field label={t("blogAdmin.editor.slug")} htmlFor="pe-slug" hint={t("blogAdmin.editor.slugHint")}>
              <div className="flex items-center rounded-[10px] border border-white/12 bg-white/[0.04] focus-within:border-[#ff4b00]">
                <span className="select-none pl-[12px] text-[13px] text-white/35">/blog/</span>
                <input
                  id="pe-slug"
                  value={slugShown}
                  onChange={(e) => {
                    setSlugTouched(true)
                    setSlugError("")
                    set({ slug: e.target.value })
                  }}
                  className="w-full bg-transparent px-[6px] py-[9px] text-[13.5px] text-white outline-none"
                />
              </div>
              {slugError && <p role="alert" className="mt-[5px] text-[12px] text-red-300">{slugError}</p>}
            </Field>
            <Field label={t("blogAdmin.editor.excerpt")} htmlFor="pe-excerpt" hint={t("blogAdmin.editor.excerptHint")}>
              <textarea id="pe-excerpt" value={form.excerpt} onChange={(e) => set({ excerpt: e.target.value })} rows={2} maxLength={400} className={inputClass} />
            </Field>
          </Card>

          <Card className="p-[16px]">
            <p className="mb-[8px] text-[12px] font-[700] text-white/70">{t("blogAdmin.editor.content")}</p>
            <RichTextEditor
              value={form.content}
              resetKey={resetKey}
              onChange={(html) => set({ content: html })}
              onUploadImage={(file) => uploadForEditor(file, "image")}
              onUploadVideo={(file) => uploadForEditor(file, "video")}
            />
          </Card>

          <Card className="space-y-[14px] p-[16px]">
            <p className="text-[13px] font-[800] text-white">{t("blogAdmin.editor.seo")}</p>
            <Field label={t("blogAdmin.editor.seoTitle")} htmlFor="pe-seot" hint={t("blogAdmin.editor.chars", { n: form.seoTitle.length, max: 120 })}>
              <input id="pe-seot" value={form.seoTitle} onChange={(e) => set({ seoTitle: e.target.value })} maxLength={120} placeholder={form.title} className={inputClass} />
            </Field>
            <Field label={t("blogAdmin.editor.seoDescription")} htmlFor="pe-seod" hint={t("blogAdmin.editor.chars", { n: form.seoDescription.length, max: 300 })}>
              <textarea id="pe-seod" value={form.seoDescription} onChange={(e) => set({ seoDescription: e.target.value })} rows={2} maxLength={300} placeholder={form.excerpt} className={inputClass} />
            </Field>
          </Card>
        </div>

        <aside className="min-w-0 space-y-[16px]">
          <Card className="space-y-[14px] p-[16px]">
            <Field label={t("blogAdmin.editor.status")} htmlFor="pe-status">
              <select id="pe-status" value={form.status} onChange={(e) => set({ status: e.target.value })} className={inputClass}>
                {(canPublish ? ["draft", "published", "scheduled", "archived"] : ["draft"]).map((s) => (
                  <option key={s} value={s}>
                    {t(`blogAdmin.status.${s}`)}
                  </option>
                ))}
              </select>
            </Field>
            {form.status === "scheduled" && (
              <Field label={t("blogAdmin.editor.scheduledAt")} htmlFor="pe-sched" hint={t("blogAdmin.editor.scheduleHint")}>
                <input id="pe-sched" type="datetime-local" value={form.scheduledAt} onChange={(e) => set({ scheduledAt: e.target.value })} className={inputClass} />
              </Field>
            )}
            <label className="flex cursor-pointer items-center gap-[9px] text-[13px] text-white/85">
              <input type="checkbox" checked={form.featured} onChange={(e) => set({ featured: e.target.checked })} className="h-[15px] w-[15px] accent-[#ff4b00]" />
              {t("blogAdmin.editor.featured")}
            </label>
          </Card>

          <Card className="space-y-[14px] p-[16px]">
            <Field label={t("blogAdmin.editor.category")} htmlFor="pe-cat">
              <select id="pe-cat" value={form.category || ""} onChange={(e) => set({ category: e.target.value })} className={inputClass}>
                <option value="">{t("blogAdmin.editor.noCategory")}</option>
                {taxonomy.categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("blogAdmin.editor.tags")} htmlFor="pe-tags" hint={t("blogAdmin.editor.tagsHint")}>
              {form.tags.length > 0 && (
                <ul className="mb-[8px] flex flex-wrap gap-[6px]">
                  {form.tags.map((tag) => (
                    <li key={tag} className="inline-flex items-center gap-[5px] rounded-full bg-white/[0.08] py-[3px] pl-[10px] pr-[5px] text-[12px] text-white/85">
                      #{tag}
                      <button type="button" onClick={() => set({ tags: form.tags.filter((x) => x !== tag) })} aria-label={t("blogAdmin.editor.removeTag", { name: tag })} className="flex h-[16px] w-[16px] items-center justify-center rounded-full text-white/50 hover:bg-white/15 hover:text-white">
                        <X size={11} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <input
                id="pe-tags"
                list="pe-tag-options"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault()
                    addTag(tagInput)
                  }
                }}
                onBlur={() => addTag(tagInput)}
                maxLength={40}
                className={inputClass}
              />
              <datalist id="pe-tag-options">
                {taxonomy.tags.map((tg) => (
                  <option key={tg._id} value={tg.name} />
                ))}
              </datalist>
            </Field>
          </Card>

          <Card className="space-y-[12px] p-[16px]">
            <p className="text-[12px] font-[700] text-white/70">{t("blogAdmin.editor.cover")}</p>
            {form.coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.coverImage} alt={form.coverImageAlt} className="aspect-[16/10] w-full rounded-[10px] object-cover" />
            ) : (
              <div className="flex aspect-[16/10] w-full items-center justify-center rounded-[10px] border border-dashed border-white/15 text-white/30">
                <ImagePlus size={26} />
              </div>
            )}
            <div className="flex gap-[8px]">
              <button type="button" onClick={() => coverInput.current?.click()} disabled={busy} className={`${btnGhost} flex-1`}>
                {uploading === "coverImage" ? <Spinner /> : <Upload size={14} />}
                {form.coverImage ? t("blogAdmin.editor.replace") : t("blogAdmin.editor.upload")}
              </button>
              {form.coverImage && (
                <button type="button" onClick={() => set({ coverImage: "" })} aria-label={t("blogAdmin.editor.remove")} className={`${btnGhost} !px-[10px]`}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" hidden onChange={(e) => { uploadTo(e.target.files?.[0], "image", "coverImage"); e.target.value = "" }} />
            <Field label={t("blogAdmin.editor.coverAlt")} htmlFor="pe-alt">
              <input id="pe-alt" value={form.coverImageAlt} onChange={(e) => set({ coverImageAlt: e.target.value })} maxLength={200} className={inputClass} />
            </Field>
          </Card>

          <Card className="space-y-[12px] p-[16px]">
            <p className="text-[12px] font-[700] text-white/70">{t("blogAdmin.editor.featuredVideo")}</p>
            <input
              value={form.featuredVideo}
              onChange={(e) => set({ featuredVideo: e.target.value })}
              placeholder={t("blogAdmin.editor.videoPlaceholder")}
              aria-label={t("blogAdmin.editor.featuredVideo")}
              className={inputClass}
            />
            <div className="flex gap-[8px]">
              <button type="button" onClick={() => videoInput.current?.click()} disabled={busy} className={`${btnGhost} flex-1`}>
                {uploading === "featuredVideo" ? <Spinner /> : <Upload size={14} />}
                {t("blogAdmin.editor.uploadVideo")}
              </button>
              {form.featuredVideo && (
                <button type="button" onClick={() => set({ featuredVideo: "" })} aria-label={t("blogAdmin.editor.remove")} className={`${btnGhost} !px-[10px]`}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <input ref={videoInput} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => { uploadTo(e.target.files?.[0], "video", "featuredVideo"); e.target.value = "" }} />
          </Card>
        </aside>
      </div>

      {previewing && <PreviewModal form={form} categoryName={categoryName} onClose={() => setPreviewing(false)} />}
    </div>
  )
}
