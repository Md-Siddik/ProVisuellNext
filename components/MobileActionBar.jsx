"use client"

import { useState } from "react"
import {
  Check,
  Layers3,
  MessageCircle,
  Share2,
  ShoppingCart,
  Sparkles,
} from "lucide-react"

import EditableText from "../dashboard/editor/EditableText"
import { useTranslation } from "@/lib/i18n"

import {
  OPEN_CHAT_EVENT,
  OPEN_ORDER_EVENT,
} from "./StartOrderModal"

const MobileActionBar = () => {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = window.location.href

    try {
      if (navigator.share) {
        await navigator.share({
          title: document.title || "ProVisuell",
          text: "ProVisuell",
          url,
        })

        return
      }

      await navigator.clipboard.writeText(url)

      setCopied(true)

      setTimeout(() => {
        setCopied(false)
      }, 1800)
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("Share failed:", error)
      }
    }
  }

  const handleOrder = () => {
    window.dispatchEvent(
      new Event(OPEN_ORDER_EVENT)
    )
  }

  const handleMessage = () => {
    window.dispatchEvent(
      new Event(OPEN_CHAT_EVENT)
    )
  }

  return (
    <div
      className="
        fixed
        left-1/2
        z-[100]
        flex
        h-[66px]
        w-[calc(100%-28px)]
        max-w-[390px]
        -translate-x-1/2
        items-center
        justify-between
        rounded-[23px]
        border
        border-white/[0.08]
        bg-[#0c0d0d]/95
        px-[9px]
        shadow-[0_18px_50px_rgba(0,0,0,0.55)]
        backdrop-blur-[22px]
        lg:hidden
        [bottom:calc(10px+env(safe-area-inset-bottom,0px))]
      "
      role="navigation"
      aria-label={t("mobileActionBar.quickActions")}
    >
      {/* SHARE */}

      <button
        type="button"
        onClick={handleShare}
        aria-label={t("mobileActionBar.share")}
        className="
          group
          relative
          flex
          h-[50px]
          w-[58px]
          shrink-0
          items-center
          justify-center
          rounded-[17px]
          text-white/70
          outline-none
          transition-all
          duration-200
          hover:bg-white/[0.04]
          hover:text-white
          active:scale-[0.92]
          active:bg-white/[0.07]
        "
      >
        <span
          className="
            flex
            h-[36px]
            w-[36px]
            items-center
            justify-center
            rounded-full
            text-white/80
            transition-all
            duration-200
            group-active:text-[#ff5a12]
          "
        >
          {copied ? (
            <Check
              size={20}
              strokeWidth={2}
            />
          ) : (
            <Share2
              size={20}
              strokeWidth={1.85}
            />
          )}
        </span>

        {copied && (
          <span
            className="
              absolute
              -top-[31px]
              left-1/2
              -translate-x-1/2
              whitespace-nowrap
              rounded-[7px]
              border
              border-white/[0.08]
              bg-[#151515]
              px-[8px]
              py-[5px]
              text-[9px]
              font-[700]
              text-white
              shadow-lg
            "
          >
            {t("mobileActionBar.linkCopied")}
          </span>
        )}
      </button>

      {/* MAIN ORDER BUTTON */}

      <button
        type="button"
        onClick={handleOrder}
        aria-label={t("mobileActionBar.orderNow")}
        className="
          group
          relative
          mx-[4px]
          flex
          h-[52px]
          min-w-0
          flex-1
          items-center
          justify-center
          overflow-hidden
          rounded-full
          bg-[#ff4b00]
          px-[18px]
          text-white
          shadow-[0_7px_22px_rgba(255,75,0,0.38)]
          outline-none
          transition-all
          duration-200
          hover:bg-[#ff5710]
          active:scale-[0.97]
        "
      >
        {/* subtle inner highlight */}

        <span
          className="
            pointer-events-none
            absolute
            inset-x-[12px]
            top-0
            h-px
            bg-gradient-to-r
            from-transparent
            via-white/40
            to-transparent
          "
        />

        {/* subtle orange glow */}

        <span
          className="
            pointer-events-none
            absolute
            -right-[18px]
            -top-[25px]
            h-[74px]
            w-[74px]
            rounded-full
            bg-white/[0.10]
            blur-[22px]
          "
        />

        <span
          className="
            relative
            flex
            items-center
            justify-center
            gap-[9px]
          "
        >
          <Layers3
  size={20}
  strokeWidth={1.9}
/>

          <span
            className="
              whitespace-nowrap
              text-[15px]
              font-[750]
              leading-none
              tracking-[-0.015em]
            "
          >
            <EditableText k="header.startProject" />
          </span>
        </span>
      </button>

      {/* MESSAGE */}

      <button
        type="button"
        onClick={handleMessage}
        aria-label={t("mobileActionBar.messages")}
        className="
          group
          flex
          h-[50px]
          w-[58px]
          shrink-0
          items-center
          justify-center
          rounded-[17px]
          text-white/70
          outline-none
          transition-all
          duration-200
          hover:bg-white/[0.04]
          hover:text-white
          active:scale-[0.92]
          active:bg-white/[0.07]
        "
      >
        <span
          className="
            flex
            h-[36px]
            w-[36px]
            items-center
            justify-center
            rounded-full
            text-white/75
            transition-all
            duration-200
            group-active:text-[#ff5a12]
          "
        >
          <MessageCircle
            size={21}
            strokeWidth={1.8}
          />
        </span>
      </button>
    </div>
  )
}

export default MobileActionBar