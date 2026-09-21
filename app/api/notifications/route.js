import { NextResponse } from "next/server"
import { authenticate, withApiErrors } from "@/lib/auth"
import { Notification } from "@/lib/models/Notification"

export const GET = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  const notifications = await Notification.find({ user: user._id }).sort({ createdAt: -1 }).limit(30)
  return NextResponse.json({ notifications })
})
