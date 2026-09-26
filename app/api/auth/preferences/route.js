import { NextResponse } from "next/server"
import { ApiError, authenticate, withApiErrors } from "@/lib/auth"
import { isTimeFormat } from "@/lib/appointments/time"
import { isLanguage } from "@/lib/i18n/server"

// The signed-in user's display preferences:
//   timeFormat "12h" | "24h" — presentation only, never changes stored times
//   language   "no" | "en" | "sv" | "fi" | "da" — the language emails to them use
export const PATCH = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  const { timeFormat, language } = (await request.json().catch(() => ({}))) || {}
  if (timeFormat === undefined && language === undefined) throw new ApiError(400, "Nothing to change")
  if (timeFormat !== undefined) {
    if (!isTimeFormat(timeFormat)) throw new ApiError(400, "Invalid time format")
    user.timeFormat = timeFormat
  }
  if (language !== undefined) {
    if (!isLanguage(language)) throw new ApiError(400, "Invalid language")
    user.language = language
  }
  await user.save()
  return NextResponse.json({ user })
})
