import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { audienceCounts, shareTargets } from "@/lib/notes/service"

// For the share picker: staff members a note can be shared with individually
// (everyone who can use Notes, except the caller), and how many people each
// role reaches. Only for people allowed to share.
export const GET = withApiErrors(async (request) => {
  const auth = requirePermission(await authenticate(request), "notes.view", "notes.share")
  const [users, counts] = await Promise.all([shareTargets(auth), audienceCounts(auth)])
  return NextResponse.json({ users, counts })
})

export const dynamic = "force-dynamic"
