"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertCircle, CheckCircle2 } from "lucide-react"

// Tiny toast for blog interactions (copy link, failed like…). Same look as the
// editor's toast: a small pill bottom-right, gone after a couple of seconds.
export function useBlogToast() {
  const [toast, setToast] = useState(null)
  const timer = useRef(null)

  const show = useCallback((message, kind = "success") => {
    clearTimeout(timer.current)
    setToast({ message, kind, id: Date.now() })
    timer.current = setTimeout(() => setToast(null), 2800)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  const node = toast ? (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-[24px] left-1/2 z-[1100] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-[8px] rounded-[10px] px-[16px] py-[11px] text-[13px] font-[600] text-white shadow-xl ${
        toast.kind === "error" ? "bg-red-600" : "bg-[#ff4b00]"
      }`}
    >
      {toast.kind === "error" ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
      {toast.message}
    </div>
  ) : null

  return [node, show]
}
