"use client"

import { CalendarClock, CircleCheck, CircleX } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { useTimeFormat } from "@/context/TimeFormatContext"
import { attendanceStatus } from "@/lib/appointments/attendance"

const STYLE = {
  scheduled: { icon: CalendarClock, cls: "border-white/20 text-white/70" },
  joined: { icon: CircleCheck, cls: "border-emerald-500/40 text-emerald-300" },
  missed: { icon: CircleX, cls: "border-red-500/40 text-red-300" },
}

// Scheduled / Joined / Missed. Derived client-side too, so a meeting that
// ends while the page is open flips to "Missed" without a reload. The
// tooltip says what "Joined" actually means: the Join button was used.
export default function AttendanceBadge({ appointment, showTime = false, className = "" }) {
  const { t } = useTranslation()
  const { formatInstantTime } = useTimeFormat()
  const status = attendanceStatus(appointment)
  const { icon: Icon, cls } = STYLE[status]
  return (
    <span
      title={t(`attendance.hint_${status}`)}
      className={`inline-flex items-center gap-[5px] rounded-[6px] border px-[8px] py-[3px] text-[11px] font-[800] uppercase tracking-[0.02em] ${cls} ${className}`}
    >
      <Icon size={12} aria-hidden="true" />
      {t(`attendance.${status}`)}
      {showTime && status === "joined" && appointment.joinedAt && (
        <span className="font-[600] normal-case tabular-nums opacity-80">· {formatInstantTime(appointment.joinedAt)}</span>
      )}
    </span>
  )
}
