import { NextResponse } from "next/server"
import { ApiError, authenticate, withApiErrors } from "@/lib/auth"
import { isTimeFormat } from "@/lib/appointments/time"

// The signed-in user's display preferences. Only the 12h/24h time format so
// far — presentation only, it never changes stored times.
export const PATCH = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  const { timeFormat } = (await request.json().catch(() => ({}))) || {}
  if (!isTimeFormat(timeFormat)) throw new ApiError(400, "Invalid time format")
  user.timeFormat = timeFormat
  await user.save()
  return NextResponse.json({ user })
})
