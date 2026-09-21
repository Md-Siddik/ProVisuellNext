"use client"

import { useEffect, useRef } from "react"
import { useTranslation } from "@/lib/i18n"

export default function UnreadBadge({
  count = 0,
  className = "",
}) {
  const { t } = useTranslation()
  const badgeRef = useRef(null)
  const previousCountRef = useRef(count)

  useEffect(() => {
    if (
      count > previousCountRef.current &&
      badgeRef.current
    ) {
      badgeRef.current.animate(
        [
          {
            transform: "scale(0.85)",
            opacity: 0.6,
          },
          {
            transform: "scale(1.12)",
            opacity: 1,
          },
          {
            transform: "scale(1)",
            opacity: 1,
          },
        ],
        {
          duration: 260,
          easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        }
      )
    }

    previousCountRef.current = count
  }, [count])

  if (!count || count <= 0) {
    return null
  }

  const displayCount =
    count > 99 ? "99+" : count

  return (
    <span
      ref={badgeRef}
      aria-label={t("notifications.unreadMessagesAria", { n: count })}
      className={`
        pointer-events-none
        flex
        h-[22px]
        min-w-[22px]
        items-center
        justify-center
        rounded-full
        border-[2px]
        border-[#111212]
        bg-white
        px-[5px]
        text-[15px]
        font-[850]
        leading-none
        tracking-[-0.02em]
        text-[#ff4b00]
        shadow-[0_3px_12px_rgba(0,0,0,0.28)]
        ${className}
      `}
    >
      {displayCount}
    </span>
  )
}