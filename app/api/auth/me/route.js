import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"

export const GET = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  return NextResponse.json({ user })
})
