"use client"

import { useEffect, useRef, useState } from "react"
import { Mic, Square, Trash2 } from "lucide-react"
import { useTranslation } from "@/lib/i18n"

const MAX_SECONDS = 300
const CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"]

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null
  return CANDIDATES.find((t) => MediaRecorder.isTypeSupported?.(t)) || ""
}

// Records a short voice note in the browser (MediaRecorder), with preview
// before it's saved. onChange({ blob, durationSec }) or onChange(null).
export default function VoiceRecorder({ value, onChange, disabled = false }) {
  const { t } = useTranslation()
  const [state, setState] = useState("idle") // idle | recording
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState("")
  const [previewUrl, setPreviewUrl] = useState(null)
  const recorder = useRef(null)
  const chunks = useRef([])
  const timer = useRef(null)
  const stream = useRef(null)
  const supported = typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia

  useEffect(() => {
    if (!value?.blob) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(value.blob)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [value])

  // Always release the microphone.
  useEffect(() => () => stop(true), [])

  function stop(discard = false) {
    clearInterval(timer.current)
    if (recorder.current && recorder.current.state !== "inactive") {
      if (discard) recorder.current.ondataavailable = null
      recorder.current.stop()
    }
    stream.current?.getTracks().forEach((tr) => tr.stop())
    stream.current = null
  }

  async function start() {
    setError("")
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = pickMimeType()
      const rec = new MediaRecorder(stream.current, mimeType ? { mimeType } : undefined)
      chunks.current = []
      const startedAt = Date.now()
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
      rec.onstop = () => {
        setState("idle")
        if (!chunks.current.length) return
        const blob = new Blob(chunks.current, { type: rec.mimeType || mimeType || "audio/webm" })
        onChange({ blob, durationSec: Math.round((Date.now() - startedAt) / 1000) })
      }
      rec.start(250)
      recorder.current = rec
      setSeconds(0)
      setState("recording")
      timer.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) stop()
          return s + 1
        })
      }, 1000)
    } catch (err) {
      stop(true)
      setError(err?.name === "NotAllowedError" ? t("notesPage.micDenied") : t("notesPage.micUnavailable"))
    }
  }

  if (!supported) return <p className="text-[12px] text-white/40">{t("notesPage.voiceUnsupported")}</p>

  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`

  return (
    <div className="space-y-[8px]">
      <div className="flex flex-wrap items-center gap-[10px]">
        {state === "recording" ? (
          <button
            type="button"
            onClick={() => stop()}
            className="inline-flex items-center gap-[8px] rounded-[8px] bg-red-600 px-[12px] py-[8px] text-[12.5px] font-[800] text-white hover:bg-red-500"
          >
            <Square size={13} fill="currentColor" /> {t("notesPage.stopRecording")} · {mmss(seconds)}
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={disabled}
            className="inline-flex min-h-[40px] items-center gap-[8px] rounded-[8px] border border-white/15 px-[12px] py-[8px] text-[12.5px] font-[700] text-white/80 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-[#ff4b00] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Mic size={14} className="text-[#ff4b00]" /> {value ? t("notesPage.recordAgain") : t("notesPage.recordVoice")}
          </button>
        )}
        {state === "recording" && <span className="h-[8px] w-[8px] animate-pulse rounded-full bg-red-500" aria-hidden="true" />}
        {value && state !== "recording" && (
          <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-[6px] text-[12px] text-white/50 hover:text-red-300">
            <Trash2 size={13} /> {t("notesPage.removeVoice")}
          </button>
        )}
      </div>
      {previewUrl && <audio controls src={previewUrl} className="h-[36px] w-full max-w-[360px]" aria-label={t("notesPage.voicePreview")} />}
      {error && <p className="text-[12px] text-red-300">{error}</p>}
    </div>
  )
}
