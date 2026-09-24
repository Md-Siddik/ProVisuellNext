"use client"

import { useRef } from "react"
import { useTimeFormat } from "@/context/TimeFormatContext"
import { useTranslation } from "@/lib/i18n"

const OPTIONS = [
  { value: "12h", labelKey: "timeFormat.twelveHour", ariaKey: "timeFormat.useTwelveHour" },
  { value: "24h", labelKey: "timeFormat.twentyFourHour", ariaKey: "timeFormat.useTwentyFourHour" },
]

// Compact 12-hour | 24-hour switch. Changing it only re-formats what's on
// screen — nothing is refetched and no stored time changes.
export default function TimeFormatToggle({ className = "", showLabel = true }) {
  const { t } = useTranslation()
  const { timeFormat, setTimeFormat } = useTimeFormat()
  const refs = useRef([])

  // Radio-group keyboard behavior: arrows move and select.
  const onKeyDown = (e, i) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return
    e.preventDefault()
    const next = (i + 1) % OPTIONS.length
    setTimeFormat(OPTIONS[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div className={`flex items-center gap-[10px] ${className}`}>
      {showLabel && <span className="text-[12px] font-[600] text-white/60">{t("timeFormat.label")}</span>}
      <div role="radiogroup" aria-label={t("timeFormat.label")} className="inline-flex rounded-[8px] border border-white/15 bg-white/[0.03] p-[2px]">
        {OPTIONS.map((opt, i) => {
          const active = timeFormat === opt.value
          return (
            <button
              key={opt.value}
              ref={(el) => (refs.current[i] = el)}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={t(opt.ariaKey)}
              tabIndex={active ? 0 : -1}
              onClick={() => setTimeFormat(opt.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`rounded-[6px] px-[10px] py-[4px] text-[11.5px] font-[700] transition-colors focus-visible:outline-2 focus-visible:outline-[#ff4b00] ${
                active ? "bg-[#ff4b00] text-white" : "text-white/60 hover:text-white"
              }`}
            >
              {t(opt.labelKey)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
