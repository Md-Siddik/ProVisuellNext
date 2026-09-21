"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, Copy, Film, Trash2, Upload } from "lucide-react"
import { api } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { Card, Empty, ErrorNote, LoadingBlock, Pager, Spinner, btnPrimary, iconBtn, inputClass } from "./adminUi"
import { checkMediaFile, MAX_IMAGE_MB, MAX_VIDEO_MB, uploadBlogMedia } from "./media"

const sizeLabel = (bytes) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

export default function MediaLibrary() {
  const { t } = useTranslation()
  const [type, setType] = useState("")
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState("")
  const [dragging, setDragging] = useState(false)
  const input = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const sp = new URLSearchParams({ page: String(page), limit: "18" })
      if (type) sp.set("type", type)
      setData(await api.get(`/blog/media?${sp}`))
    } catch (err) {
      console.error(err)
      setError(t("blogAdmin.loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [page, type, t])

  useEffect(() => {
    load()
  }, [load])
  useEffect(() => setPage(1), [type])

  const upload = async (files) => {
    setError("")
    setUploading(true)
    for (const file of files) {
      const problem = checkMediaFile(file, "any")
      if (problem) {
        setError(`${file.name}: ${t(problem.key, problem.vars)}`)
        continue
      }
      try {
        await uploadBlogMedia(file)
      } catch (err) {
        console.error(err)
        setError(`${file.name}: ${t("blogAdmin.editor.uploadFailed")}`)
      }
    }
    setUploading(false)
    setPage(1)
    await load()
  }

  const remove = async (m) => {
    if (!window.confirm(t("blogAdmin.media.deleteConfirm"))) return
    try {
      await api.delete(`/blog/media/${m._id}`)
      await load()
    } catch (err) {
      console.error(err)
      setError(t("blogAdmin.actionFailed"))
    }
  }

  const copy = async (m) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${m.url}`)
      setCopied(m._id)
      setTimeout(() => setCopied(""), 1800)
    } catch {
      setError(t("blog.copyFailed"))
    }
  }

  const media = data?.media || []

  return (
    <div className="space-y-[14px]">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); upload([...e.dataTransfer.files]) }}
        className={`flex flex-col items-center justify-center gap-[10px] rounded-[14px] border border-dashed px-[16px] py-[26px] text-center transition-colors ${dragging ? "border-[#ff4b00] bg-[#ff4b00]/[0.06]" : "border-white/15"}`}
      >
        <button type="button" onClick={() => input.current?.click()} disabled={uploading} className={btnPrimary}>
          {uploading ? <Spinner /> : <Upload size={15} />}
          {uploading ? t("blogAdmin.editor.uploading") : t("blogAdmin.media.upload")}
        </button>
        <p className="text-[12px] text-white/40">{t("blogAdmin.media.hint", { img: MAX_IMAGE_MB, vid: MAX_VIDEO_MB })}</p>
        <input ref={input} type="file" multiple hidden accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime" onChange={(e) => { upload([...e.target.files]); e.target.value = "" }} />
      </div>

      <div className="flex items-center gap-[10px]">
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label={t("blogAdmin.media.type")} className={`${inputClass} !w-auto`}>
          <option value="">{t("blogAdmin.media.all")}</option>
          <option value="image">{t("blogAdmin.media.images")}</option>
          <option value="video">{t("blogAdmin.media.videos")}</option>
        </select>
      </div>

      <ErrorNote onRetry={load}>{error}</ErrorNote>

      {loading && !data ? (
        <LoadingBlock rows={3} />
      ) : media.length === 0 ? (
        <Empty>{t("blogAdmin.media.empty")}</Empty>
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <ul className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {media.map((m) => (
              <li key={m._id}>
                <Card className="overflow-hidden">
                  <div className="relative aspect-square bg-black/40">
                    {m.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt={m.fileName} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-[6px] text-white/40">
                        <Film size={26} />
                        <span className="text-[11px]">{t("blog.video")}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-[8px]">
                    <p className="truncate text-[11.5px] text-white/70" title={m.fileName}>{m.fileName}</p>
                    <p className="text-[10.5px] text-white/35">{sizeLabel(m.size)}</p>
                    <div className="mt-[4px] flex justify-between">
                      <button type="button" className={iconBtn} onClick={() => copy(m)} title={t("blog.copyLink")} aria-label={t("blog.copyLink")}>
                        {copied === m._id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>
                      <button type="button" className={`${iconBtn} hover:!text-red-400`} onClick={() => remove(m)} title={t("blog.delete")} aria-label={t("blog.delete")}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          <Pager page={data.page} pages={data.pages} onPage={setPage} />
        </div>
      )}
    </div>
  )
}
