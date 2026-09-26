import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { meetingRoomUrl } from "@/lib/meeting"

// Staff-level access to the meeting room link (the dashboard "join meeting"
// card). Customers never get it here — only via the join endpoint at
// meeting time.
export const GET = withApiErrors(async (request) => {
  requirePermission(await authenticate(request), "appointments.view")
  return NextResponse.json({ meetingUrl: meetingRoomUrl() }, { headers: { "Cache-Control": "no-store" } })
})
