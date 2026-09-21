import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"

// Called right after a successful Firebase login/signup. authenticate()
// already does the upsert; this just fills in name/phone the first time.
export const POST = withApiErrors(async (request) => {
  const { name, phone } = (await request.json().catch(() => ({}))) || {}
  const { user } = await authenticate(request)
  if (name && !user.name) user.name = name
  if (phone && !user.phone) user.phone = phone
  await user.save()
  return NextResponse.json({ user })
})
