import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { ApiError, authenticate, withApiErrors } from "@/lib/auth"
import { requireSuperAdmin } from "@/lib/access"
import { processDueReminders } from "@/lib/notes/service"

// Runs the note reminder / expiry processor once. For schedulers that call
// an URL (server cron, Vercel Cron, an uptime pinger…):
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/notes/reminders/run
// The in-process ticker (instrumentation.js) does the same every minute on a
// normal `next start` server. Safe to call any number of times, in parallel.
// Also callable by the Super Admin (signed in) for a manual run.
function hasCronSecret(request) {
  const secret = process.env.CRON_SECRET || ""
  const header = request.headers.get("authorization") || ""
  const given = header.startsWith("Bearer ") ? header.slice(7) : ""
  if (secret.length < 16 || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

async function run(request) {
  if (!hasCronSecret(request)) {
    // Not the scheduler: only the signed-in Super Admin may trigger it.
    const auth = await authenticate(request).catch(() => {
      throw new ApiError(401, "Missing bearer token")
    })
    requireSuperAdmin(auth)
  }
  const result = await processDueReminders(new Date())
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
}

export const POST = withApiErrors(run)
// Vercel Cron and some schedulers only send GET.
export const GET = withApiErrors(run)
