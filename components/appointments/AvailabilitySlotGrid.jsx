"use client"

import { useEffect, useRef } from "react"
import { useTimeFormat } from "@/context/TimeFormatContext"
import { useTranslation } from "@/lib/i18n"
import { groupSlots } from "@/lib/appointments/time"

// Bookable time slots for one day, grouped Night / Morning / Afternoon /
// Evening inside a scrollable area. `slots` come straight from the
// availability API ({ time: "HH:MM", available, reason }); only the label
// is formatted, so switching 12h/24h keeps the same slot selected.
export default function AvailabilitySlotGrid({ slots, selectedTime, onSelect }) {
  const { t } = useTranslation()
  const { formatTime } = useTimeFormat()
  const scroller = useRef(null)

  // Open on the first bookable slot instead of midnight.
  useEffect(() => {
    const el = scroller.current?.querySelector("[data-first-available]")
    if (el && scroller.current) scroller.current.scrollTop = el.offsetTop - scroller.current.offsetTop - 36
  }, [slots])

  const firstAvailable = slots.find((s) => s.available)?.time

  return (
    <div ref={scroller} className="relative max-h-[min(300px,38vh)] overflow-y-auto rounded-[10px] border border-white/10 bg-white/[0.015] p-[10px] pt-0">
      {groupSlots(slots).map((group) => (
        <section key={group.key} aria-label={t(`timeFormat.group_${group.key}`)}>
          <h3 className="sticky top-0 z-[1] -mx-[10px] bg-[#131414] px-[10px] pb-[6px] pt-[10px] text-[10.5px] font-[800] uppercase tracking-[0.1em] text-white/40">
            {t(`timeFormat.group_${group.key}`)}
          </h3>
          <div className="grid grid-cols-2 gap-[8px] sm:grid-cols-3 md:grid-cols-4">
            {group.items.map((slot) => {
              const isSelected = selectedTime === slot.time
              const label = formatTime(slot.time)
              return (
                <button
                  key={slot.time}
                  type="button"
                  disabled={!slot.available}
                  aria-pressed={slot.available ? isSelected : undefined}
                  aria-label={slot.available ? label : `${label}, ${t("bookMeetingModal.slotUnavailable")}`}
                  title={slot.available ? undefined : t("bookMeetingModal.slotUnavailable")}
                  data-first-available={slot.time === firstAvailable ? "" : undefined}
                  onClick={() => onSelect(slot.time)}
                  className={`rounded-[7px] border py-[8px] text-[12px] font-[700] tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-[#ff4b00] ${
                    isSelected
                      ? "border-[#ff4b00] bg-[#ff4b00] text-white"
                      : slot.available
                        ? "border-white/15 bg-white/[0.03] text-white/85 hover:border-[#ff4b00]/60"
                        : "cursor-not-allowed border-white/5 bg-white/[0.01] text-white/20 line-through"
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
