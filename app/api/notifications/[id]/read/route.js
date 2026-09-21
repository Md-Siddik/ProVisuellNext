import { authenticate, withApiErrors } from "@/lib/auth"
import { Notification } from "@/lib/models/Notification"

export const POST = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const { user } = await authenticate(request)
  await Notification.updateOne({ _id: id, user: user._id }, { read: true })
  return new Response(null, { status: 204 })
})
