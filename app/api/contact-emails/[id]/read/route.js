import mongoose from "mongoose"
import { ApiError, authenticate, withApiErrors } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { ContactEmail } from "@/lib/models/ContactEmail"

export const POST = withApiErrors(async (request, { params }) => {
  const { id } = await params
  requirePermission(await authenticate(request), "messages.viewEmailInbox")
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Not found")
  await ContactEmail.updateOne({ _id: id }, { read: true })
  return new Response(null, { status: 204 })
})
