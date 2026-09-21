"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { api } from "@/lib/api"
import AnchoredPopover from "./AnchoredPopover"

const SOCIAL_WORD_KEYS = { email: "editor.socialEmail", website: "editor.socialWebsite", other: "editor.socialOther" }

// One reusable add/edit form for any CMS collection item — which fields it
// shows is entirely driven by `fieldsConfig`, so services / portfolio items
// / featured projects / nav items / hero services all share this instead of
// bespoke forms. Opens as a popover anchored to whatever was clicked
// (the card, or its Edit button) rather than a page-centered modal, so it's
// always right beside the element being edited.
export default function CmsItemEditor({ anchorRef, open, fieldsConfig, hasLink, hasVideo, iconOptions, item, addItem, updateItem, onClose }) {
  const { language, t } = useTranslation()
  // Platform names are brand names and stay as-is; only these three are plain words.
  const optionLabel = (key, label) => (SOCIAL_WORD_KEYS[key] ? t(SOCIAL_WORD_KEYS[key]) : label)
  const isNew = !item

  const initialFields = {}
  for (const f of fieldsConfig) {
    initialFields[f.key] = item?.raw?.translations?.[f.key]?.[language] || ""
  }

  const [fields, setFields] = useState(initialFields)
  const [link, setLink] = useState(item?.link || "")
  const [image, setImage] = useState(item?.image || "")
  const [video, setVideo] = useState(item?.video || "")
  const [published, setPublished] = useState(item ? item.published : true)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [error, setError] = useState("")

  const uploadMedia = async (file, setUrl, setUploading) => {
    setUploading(true)
    setError("")
    try {
      const fd = new FormData()
      fd.append("file", file)
      const { url } = await api.postForm("/site-content/upload-media", fd)
      setUrl(url)
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    // Defensive guard independent of the Save button's disabled state — a
    // save must never fire while a file is still uploading, or the item
    // would be created/updated with an empty image/video field.
    if (uploadingImage || uploadingVideo) return
    setSaving(true)
    setError("")
    try {
      const payload = { language, fields, link, image, video, published }
      if (isNew) await addItem(payload)
      else await updateItem(item._id, payload)
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  // A close estimate of the rendered form height (varies a lot by field
  // count / link / video), so the popover only flips above the icon when
  // it genuinely needs to — a flat oversized guess made it look like the
  // editor was opening "far away" for short forms.
  const estimatedHeight =
    60 + // header row
    fieldsConfig.reduce((sum, f) => sum + (f.type === "textarea" ? 90 : 70), 0) +
    (hasLink ? 70 : 0) +
    (iconOptions ? 40 + Math.ceil(iconOptions.length / 4) * 46 : 100) + // icon picker grid (scales with option count), or the image upload section
    (hasVideo ? 100 : 0) +
    90 // published checkbox + action buttons

  return (
    <AnchoredPopover anchorRef={anchorRef} open={open} onClose={onClose} width={340} height={estimatedHeight} className="pv-cms-popover">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-[800] text-white">
          {isNew ? t("editor.addItemTitle") : t("editor.editItemTitle")}{" "}
          <span className="ml-[6px] text-[10px] font-[700] uppercase tracking-[0.05em] text-[#ff4b00]">{language.toUpperCase()}</span>
        </h3>
        <button type="button" onClick={onClose} className="text-white/50 hover:text-white">
          <X size={16} />
        </button>
      </div>

      {fieldsConfig.map((f) => (
        <div key={f.key} className="mt-[12px]">
          <label className="mb-[5px] block text-[11px] font-[600] text-white/70">{t(f.label)}</label>
          {f.type === "textarea" ? (
            <textarea
              rows={3}
              value={fields[f.key] || ""}
              onChange={(e) => setFields((s) => ({ ...s, [f.key]: e.target.value }))}
              className="w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[9px] py-[7px] text-[12.5px] text-white outline-none focus:border-[#ff4b00]"
            />
          ) : (
            <input
              value={fields[f.key] || ""}
              onChange={(e) => setFields((s) => ({ ...s, [f.key]: e.target.value }))}
              className="w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[9px] py-[7px] text-[12.5px] text-white outline-none focus:border-[#ff4b00]"
            />
          )}
        </div>
      ))}

      {hasLink && (
        <div className="mt-[12px]">
          <label className="mb-[5px] block text-[11px] font-[600] text-white/70">{t("editor.linkOptional")}</label>
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="#contact"
            className="w-full rounded-[8px] border border-white/15 bg-white/[0.04] px-[9px] py-[7px] text-[12.5px] text-white outline-none focus:border-[#ff4b00]"
          />
        </div>
      )}

      {iconOptions ? (
        <div className="mt-[12px]">
          <label className="mb-[5px] block text-[11px] font-[600] text-white/70">{t("editor.icon")}</label>
          <div className="grid grid-cols-4 gap-[6px]">
            {iconOptions.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setImage(key)}
                title={optionLabel(key, label)}
                aria-label={optionLabel(key, label)}
                className={`flex h-[40px] items-center justify-center rounded-[8px] border transition-colors ${
                  image === key
                    ? "border-[#ff4b00] bg-[#ff4b00]/15 text-[#ff4b00]"
                    : "border-white/15 bg-white/[0.04] text-white/70 hover:border-white/30 hover:text-white"
                }`}
              >
                <Icon />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-[12px]">
          <label className="mb-[5px] block text-[11px] font-[600] text-white/70">{t("editor.backgroundImage")}</label>
          {image && !uploadingImage && <img src={image} alt="" className="mb-[6px] h-[64px] w-full rounded-[8px] object-cover" />}
          <input
            type="file"
            accept="image/*"
            disabled={uploadingImage}
            onChange={(e) => e.target.files[0] && uploadMedia(e.target.files[0], setImage, setUploadingImage)}
            className="block text-[11px] text-white/70 disabled:opacity-50"
          />
          {uploadingImage && (
            <p className="mt-[6px] flex items-center gap-[6px] text-[11.5px] font-[700] text-[#ff4b00]">
              <span className="pv-upload-spinner" />
              {t("editor.uploadingImage")}
            </p>
          )}
          {!uploadingImage && image && <p className="mt-[4px] text-[11px] font-[600] text-emerald-400">{t("editor.imageAttached")}</p>}
        </div>
      )}

      {hasVideo && (
        <div className="mt-[12px]">
          <label className="mb-[5px] block text-[11px] font-[600] text-white/70">{t("editor.backgroundVideo")}</label>
          {video && !uploadingVideo && <p className="mb-[5px] truncate text-[11px] text-white/50">{video}</p>}
          <input
            type="file"
            accept="video/*"
            disabled={uploadingVideo}
            onChange={(e) => e.target.files[0] && uploadMedia(e.target.files[0], setVideo, setUploadingVideo)}
            className="block text-[11px] text-white/70 disabled:opacity-50"
          />
          {uploadingVideo && (
            <p className="mt-[6px] flex items-center gap-[6px] text-[11.5px] font-[700] text-[#ff4b00]">
              <span className="pv-upload-spinner" />
              {t("editor.uploadingVideo")}
            </p>
          )}
          {!uploadingVideo && video && <p className="mt-[4px] text-[11px] font-[600] text-emerald-400">{t("editor.videoAttached")}</p>}
          {video && !uploadingVideo && (
            <button type="button" onClick={() => setVideo("")} className="mt-[5px] text-[11px] font-[600] text-red-400">
              {t("editor.removeVideo")}
            </button>
          )}
        </div>
      )}

      <label className="mt-[14px] flex items-center gap-[7px] text-[12.5px] text-white/85">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        {t("editor.published")}
      </label>

      {error && <p className="mt-[8px] text-[11.5px] text-red-400">{error}</p>}

      <div className="mt-[16px] flex justify-end gap-[8px]">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-[8px] px-[12px] py-[7px] text-[12.5px] font-[700] text-white/70 hover:bg-white/[0.06]"
        >
          {t("editor.cancel")}
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || uploadingImage || uploadingVideo}
          className="rounded-[8px] bg-[#ff4b00] px-[14px] py-[7px] text-[12.5px] font-[700] text-white hover:brightness-110 disabled:opacity-50"
        >
          {saving ? t("editor.saving") : t("editor.save")}
        </button>
      </div>
    </AnchoredPopover>
  )
}