"use client"

import { useEffect, useRef, useState } from "react"
import { Link2, Share2 } from "lucide-react"
import { SocialIcon } from "@/components/SocialIcons"
import { useTranslation } from "@/lib/i18n"
import { useBlogToast } from "./useBlogToast"

// Sharing needs no account. `path` is the article's own path ("/blog/slug");
// the link that gets shared is built from the site the visitor is on.
export default function ShareMenu({ path, title, variant = "button", align = "right", direction = "up" }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [canNativeShare, setCanNativeShare] = useState(false)
  const [toast, showToast] = useBlogToast()
  const boxRef = useRef(null)

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function")
  }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => boxRef.current && !boxRef.current.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const url = () => `${window.location.origin}${path}`

  const copy = async () => {
    setOpen(false)
    try {
      await navigator.clipboard.writeText(url())
      showToast(t("blog.linkCopied"))
    } catch {
      showToast(t("blog.copyFailed"), "error")
    }
  }

  const nativeShare = async () => {
    setOpen(false)
    try {
      await navigator.share({ title, url: url() })
    } catch (err) {
      if (err?.name !== "AbortError") showToast(t("blog.copyFailed"), "error")
    }
  }

  const networks = [
    { key: "facebook", name: "Facebook", href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
    { key: "linkedin", name: "LinkedIn", href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}` },
    { key: "whatsapp", name: "WhatsApp", href: (u) => `https://wa.me/?text=${encodeURIComponent(`${title} ${u}`)}` },
    { key: "x", name: "X", href: (u) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(u)}&text=${encodeURIComponent(title)}` },
  ]

  const openNetwork = (network) => {
    setOpen(false)
    window.open(network.href(url()), "_blank", "noopener,noreferrer,width=640,height=560")
  }

  const itemClass =
    "flex w-full items-center gap-[10px] rounded-[8px] px-[10px] py-[9px] text-left text-[13px] font-[600] text-white/80 transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:bg-white/[0.07] focus-visible:outline-none"

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("blog.share")}
        className={
          variant === "icon"
            ? "flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/12 bg-black/40 text-white/80 backdrop-blur-sm transition-colors hover:border-white/30 hover:text-white focus-visible:outline-2 focus-visible:outline-[#ff4b00]"
            : "inline-flex h-[40px] items-center gap-[8px] rounded-full border border-white/15 px-[16px] text-[13px] font-[700] text-white/85 transition-colors hover:border-white/35 hover:text-white focus-visible:outline-2 focus-visible:outline-[#ff4b00]"
        }
      >
        <Share2 size={variant === "icon" ? 15 : 16} />
        {variant !== "icon" && t("blog.share")}
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute ${direction === "down" ? "top-[calc(100%+8px)]" : "bottom-[calc(100%+8px)]"} z-30 w-[210px] rounded-[12px] border border-white/10 bg-[#141515] p-[6px] shadow-2xl ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          {canNativeShare && (
            <button type="button" role="menuitem" onClick={nativeShare} className={itemClass}>
              <Share2 size={16} className="text-[#ff4b00]" />
              {t("blog.nativeShare")}
            </button>
          )}
          <button type="button" role="menuitem" onClick={copy} className={itemClass}>
            <Link2 size={16} className="text-[#ff4b00]" />
            {t("blog.copyLink")}
          </button>
          {networks.map((n) => (
            <button key={n.key} type="button" role="menuitem" onClick={() => openNetwork(n)} className={itemClass}>
              <span className="flex h-[16px] w-[16px] items-center justify-center text-[#ff4b00] [&>svg]:h-[16px] [&>svg]:w-[16px]">
                <SocialIcon icon={n.key} />
              </span>
              {t("blog.shareOn", { name: n.name })}
            </button>
          ))}
        </div>
      )}
      {toast}
    </div>
  )
}
