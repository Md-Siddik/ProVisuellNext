import { authenticate, withApiErrors } from "@/lib/auth"
import { Notification } from "@/lib/models/Notification"

export const POST = withApiErrors(async (request) => {
  const { user } = await authenticate(request)
  await Notification.updateMany({ user: user._id, read: false }, { read: true })
  return new Response(null, { status: 204 })
})
