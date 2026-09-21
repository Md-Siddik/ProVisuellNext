import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"
import { Notification } from "@/lib/models/Notification"

export const GET = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  const count = await Notification.countDocuments({ user: user._id, read: false })
  return NextResponse.json({ count })
})
