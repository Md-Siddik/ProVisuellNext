"use client"

import { Paperclip } from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import VoiceRecorder from "./VoiceRecorder"

export const ACCEPT = ".png,.jpg,.jpeg,.gif,.webp,.pdf,.docx,.xlsx,.pptx,.txt,.csv"
export const MAX_MB = 10

// "Attach file" + "Voice note", right under the note text. Only the buttons
// live here — uploading is the editor's own logic (onFiles / onVoice).
//   disabled    nothing to attach to yet (a new, still empty note)
//   canAddFile  false once the attachment limit is reached
export default function AttachmentBar({ disabled = false, canAddFile = true, onFiles, onVoice }) {
  const { t } = useTranslation()
  const fileDisabled = disabled || !canAddFile
  return (
    <div className="mt-[16px] border-t border-white/[0.06] pt-[12px]">
      <div className="flex flex-wrap items-center gap-[8px]" role="group" aria-label={t("notesPage.attachAndRecord")}>
        <label
          title={t("notesPage.filesHint", { mb: MAX_MB })}
          className={`inline-flex min-h-[40px] items-center gap-[8px] rounded-[8px] border border-white/15 px-[12px] text-[12.5px] font-[700] text-white/80 transition-colors focus-within:outline-2 focus-within:outline-[#ff4b00] ${
            fileDisabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-white/[0.06]"
          }`}
        >
          <Paperclip size={14} className="text-[#ff4b00]" /> {t("notesPage.attachFile")}
          <input
            type="file"
            multiple
            accept={ACCEPT}
            disabled={fileDisabled}
            className="sr-only"
            onChange={(e) => {
              const input = e.target
              Promise.resolve(onFiles(input.files)).finally(() => (input.value = ""))
            }}
          />
        </label>
        <VoiceRecorder value={null} onChange={onVoice} disabled={disabled} />
      </div>
      <p className="mt-[6px] text-[11.5px] text-white/35">{disabled ? t("notesPage.attachNeedsText") : t("notesPage.filesHint", { mb: MAX_MB })}</p>
    </div>
  )
}
