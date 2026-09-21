"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Bold,
  CodeXml,
  Film,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Redo2,
  RemoveFormatting,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
  Underline,
  Undo2,
  Unlink,
  Video,
} from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { toEmbedUrl } from "@/components/blog/blogUi"
import { Spinner, inputClass } from "./adminUi"
import "@/components/blog/blog.css"

// A small WYSIWYG editor built on contentEditable — no editor framework. The
// surface uses the same .blog-prose styles as the public article, so what is
// typed is what gets published. Whatever HTML it produces is sanitised again
// on the server when the post is saved, so nothing here is trusted.

function Btn({ label, active, disabled, onClick, children }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      // Keep the text selection: pressing a toolbar button must not blur the editor.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-[32px] min-w-[32px] items-center justify-center rounded-[7px] px-[6px] text-[12px] font-[700] transition-colors focus-visible:outline-2 focus-visible:outline-[#ff4b00] disabled:opacity-40 ${
        active ? "bg-[#ff4b00]/20 text-[#ff4b00]" : "text-white/70 hover:bg-white/[0.08] hover:text-white"
      }`}
    >
      {children}
    </button>
  )
}

const Sep = () => <span className="mx-[3px] h-[20px] w-px bg-white/12" aria-hidden="true" />

export default function RichTextEditor({ value, onChange, resetKey, onUploadImage, onUploadVideo, disabled = false }) {
  const { t } = useTranslation()
  const ref = useRef(null)
  const savedRange = useRef(null)
  const [active, setActive] = useState({})
  const [block, setBlock] = useState("p")
  const [bar, setBar] = useState(null) // { type: "link" | "embed" | "alt", value, img? }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const imageInput = useRef(null)
  const videoInput = useRef(null)
  const [stats, setStats] = useState({ words: 0 })

  const countWords = useCallback(() => {
    const text = ref.current?.innerText || ""
    setStats({ words: text.trim().split(/\s+/).filter(Boolean).length })
  }, [])

  // Load the document into the surface when it is first shown or replaced
  // (a different post opened) — never on every keystroke, or the caret would jump.
  useEffect(() => {
    if (!ref.current) return
    ref.current.innerHTML = value || ""
    countWords()
    try {
      document.execCommand("defaultParagraphSeparator", false, "p")
    } catch {
      // older browsers: the default separator is fine
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  const emit = useCallback(() => {
    const html = ref.current?.innerHTML || ""
    // An empty surface leaves stray markup behind ("<br>", "<p><br></p>").
    const cleaned = /^(<p>)?(<br>)?(<\/p>)?$/.test(html) ? "" : html
    onChange(cleaned)
    countWords()
  }, [onChange, countWords])

  const refreshState = useCallback(() => {
    if (!ref.current || !ref.current.contains(document.getSelection()?.anchorNode || null)) return
    const state = {}
    for (const cmd of ["bold", "italic", "underline", "insertUnorderedList", "insertOrderedList", "justifyCenter", "justifyRight"]) {
      try {
        state[cmd] = document.queryCommandState(cmd)
      } catch {
        state[cmd] = false
      }
    }
    setActive(state)
    let node = document.getSelection().anchorNode
    while (node && node !== ref.current && !/^(P|H1|H2|H3|BLOCKQUOTE|PRE|LI)$/.test(node.nodeName)) node = node.parentNode
    setBlock(node && node !== ref.current ? node.nodeName.toLowerCase() : "p")
  }, [])

  useEffect(() => {
    document.addEventListener("selectionchange", refreshState)
    return () => document.removeEventListener("selectionchange", refreshState)
  }, [refreshState])

  const exec = (cmd, arg) => {
    if (disabled) return
    ref.current?.focus()
    document.execCommand(cmd, false, arg)
    emit()
    refreshState()
  }

  const saveRange = () => {
    const sel = document.getSelection()
    if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0).cloneRange()
  }
  const restoreRange = () => {
    ref.current?.focus()
    const sel = document.getSelection()
    if (savedRange.current && sel) {
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }
  }

  const insertHtml = (html) => {
    restoreRange()
    document.execCommand("insertHTML", false, html)
    emit()
  }

  const escapeAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")

  const openBar = (type, extra = {}) => {
    saveRange()
    setBar({ type, value: "", ...extra })
  }

  const applyBar = () => {
    if (!bar) return
    const v = bar.value.trim()
    if (bar.type === "link") {
      restoreRange()
      if (v) {
        const href = /^(https?:|mailto:|tel:|\/)/i.test(v) ? v : `https://${v}`
        document.execCommand("createLink", false, href)
        emit()
      }
    } else if (bar.type === "embed") {
      const embed = toEmbedUrl(v)
      if (!embed) {
        setError(t("blogAdmin.editor.embedInvalid"))
        return
      }
      setError("")
      insertHtml(`<p><iframe src="${escapeAttr(embed)}" title="Video" allowfullscreen></iframe></p><p><br></p>`)
    } else if (bar.type === "alt" && bar.img) {
      bar.img.setAttribute("alt", v)
      emit()
    }
    setBar(null)
  }

  const uploadAndInsert = async (file, kind) => {
    if (!file) return
    setBusy(true)
    setError("")
    try {
      const url = kind === "image" ? await onUploadImage(file) : await onUploadVideo(file)
      if (kind === "image") {
        const alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ")
        insertHtml(`<figure><img src="${escapeAttr(url)}" alt="${escapeAttr(alt)}"></figure><p><br></p>`)
      } else {
        insertHtml(`<figure><video src="${escapeAttr(url)}" controls preload="none"></video></figure><p><br></p>`)
      }
    } catch (err) {
      console.error(err)
      setError(err?.uploadMessage || t("blogAdmin.editor.uploadFailed"))
    } finally {
      setBusy(false)
    }
  }

  const onPaste = (e) => {
    // Plain text only: pasted web pages would drag in foreign markup and styles.
    e.preventDefault()
    document.execCommand("insertText", false, e.clipboardData.getData("text/plain"))
    emit()
  }

  const onDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (!file) return
    saveRange()
    if (file.type.startsWith("image/")) uploadAndInsert(file, "image")
    else if (file.type.startsWith("video/")) uploadAndInsert(file, "video")
  }

  // Clicking an image lets the author edit its alt text.
  const onClickSurface = (e) => {
    if (e.target.nodeName === "IMG") setBar({ type: "alt", value: e.target.getAttribute("alt") || "", img: e.target })
  }

  const setBlockType = (tag) => exec("formatBlock", tag)

  return (
    <div className="overflow-hidden rounded-[12px] border border-white/12 bg-[#0f1010] focus-within:border-[#ff4b00]/60">
      <div className="flex flex-wrap items-center gap-[2px] border-b border-white/10 bg-white/[0.03] p-[6px]" role="toolbar" aria-label={t("blogAdmin.editor.toolbar")}>
        <Btn label={t("blogAdmin.editor.undo")} onClick={() => exec("undo")}><Undo2 size={15} /></Btn>
        <Btn label={t("blogAdmin.editor.redo")} onClick={() => exec("redo")}><Redo2 size={15} /></Btn>
        <Sep />
        <Btn label={t("blogAdmin.editor.paragraph")} active={block === "p"} onClick={() => setBlockType("p")}><Pilcrow size={15} /></Btn>
        <Btn label={t("blogAdmin.editor.h1")} active={block === "h1"} onClick={() => setBlockType("h1")}><Heading1 size={16} /></Btn>
        <Btn label={t("blogAdmin.editor.h2")} active={block === "h2"} onClick={() => setBlockType("h2")}><Heading2 size={16} /></Btn>
        <Btn label={t("blogAdmin.editor.h3")} active={block === "h3"} onClick={() => setBlockType("h3")}><Heading3 size={16} /></Btn>
        <Sep />
        <Btn label={t("blogAdmin.editor.bold")} active={active.bold} onClick={() => exec("bold")}><Bold size={15} /></Btn>
        <Btn label={t("blogAdmin.editor.italic")} active={active.italic} onClick={() => exec("italic")}><Italic size={15} /></Btn>
        <Btn label={t("blogAdmin.editor.underline")} active={active.underline} onClick={() => exec("underline")}><Underline size={15} /></Btn>
        <Sep />
        <Btn label={t("blogAdmin.editor.link")} onClick={() => openBar("link")}><Link2 size={15} /></Btn>
        <Btn label={t("blogAdmin.editor.unlink")} onClick={() => exec("unlink")}><Unlink size={15} /></Btn>
        <Sep />
        <Btn label={t("blogAdmin.editor.bulletList")} active={active.insertUnorderedList} onClick={() => exec("insertUnorderedList")}><List size={15} /></Btn>
        <Btn label={t("blogAdmin.editor.numberedList")} active={active.insertOrderedList} onClick={() => exec("insertOrderedList")}><ListOrdered size={15} /></Btn>
        <Btn label={t("blogAdmin.editor.quote")} active={block === "blockquote"} onClick={() => setBlockType(block === "blockquote" ? "p" : "blockquote")}><Quote size={15} /></Btn>
        <Btn label={t("blogAdmin.editor.code")} active={block === "pre"} onClick={() => setBlockType(block === "pre" ? "p" : "pre")}><CodeXml size={15} /></Btn>
        <Sep />
        <Btn label={t("blogAdmin.editor.alignLeft")} onClick={() => exec("justifyLeft")}><TextAlignStart size={15} /></Btn>
        <Btn label={t("blogAdmin.editor.alignCenter")} active={active.justifyCenter} onClick={() => exec("justifyCenter")}><TextAlignCenter size={15} /></Btn>
        <Btn label={t("blogAdmin.editor.alignRight")} active={active.justifyRight} onClick={() => exec("justifyRight")}><TextAlignEnd size={15} /></Btn>
        <Sep />
        <Btn label={t("blogAdmin.editor.image")} disabled={busy} onClick={() => { saveRange(); imageInput.current?.click() }}><ImagePlus size={15} /></Btn>
        <Btn label={t("blogAdmin.editor.video")} disabled={busy} onClick={() => { saveRange(); videoInput.current?.click() }}><Video size={15} /></Btn>
        <Btn label={t("blogAdmin.editor.embed")} onClick={() => openBar("embed")}><Film size={15} /></Btn>
        <Sep />
        <Btn label={t("blogAdmin.editor.clearFormatting")} onClick={() => exec("removeFormat")}><RemoveFormatting size={15} /></Btn>
        {busy && (
          <span className="ml-[8px] flex items-center gap-[6px] text-[12px] text-white/55">
            <Spinner />
            {t("blogAdmin.editor.uploading")}
          </span>
        )}
      </div>

      {bar && (
        <div className="flex flex-wrap items-center gap-[8px] border-b border-white/10 bg-[#141515] px-[10px] py-[8px]">
          <label className="text-[12px] font-[600] text-white/60" htmlFor="rte-bar-input">
            {t(`blogAdmin.editor.bar.${bar.type}`)}
          </label>
          <input
            id="rte-bar-input"
            autoFocus
            value={bar.value}
            onChange={(e) => setBar({ ...bar, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                applyBar()
              }
              if (e.key === "Escape") setBar(null)
            }}
            placeholder={bar.type === "alt" ? t("blogAdmin.editor.altPlaceholder") : "https://"}
            className={`${inputClass} !w-auto min-w-[200px] flex-1 !py-[6px]`}
          />
          <button type="button" onClick={applyBar} className="rounded-[8px] bg-[#ff4b00] px-[12px] py-[6px] text-[12px] font-[800] text-white">
            {t("blogAdmin.editor.apply")}
          </button>
          <button type="button" onClick={() => setBar(null)} className="px-[8px] py-[6px] text-[12px] font-[700] text-white/60 hover:text-white">
            {t("blog.cancel")}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="border-b border-red-500/25 bg-red-500/10 px-[12px] py-[7px] text-[12px] text-red-200">
          {error}
        </p>
      )}

      <div
        ref={ref}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={t("blogAdmin.editor.content")}
        data-placeholder={t("blogAdmin.editor.placeholder")}
        onInput={emit}
        onPaste={onPaste}
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={onClickSurface}
        onBlur={saveRange}
        className="blog-prose blog-editor-area max-h-[70vh] overflow-y-auto"
      />

      <div className="flex items-center justify-between border-t border-white/10 px-[12px] py-[6px] text-[11.5px] text-white/40">
        <span>{t("blogAdmin.editor.words", { n: stats.words })}</span>
        <span>{t("blog.minRead", { n: Math.max(1, Math.ceil(stats.words / 200)) })}</span>
      </div>

      <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" hidden onChange={(e) => { uploadAndInsert(e.target.files?.[0], "image"); e.target.value = "" }} />
      <input ref={videoInput} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => { uploadAndInsert(e.target.files?.[0], "video"); e.target.value = "" }} />
    </div>
  )
}
