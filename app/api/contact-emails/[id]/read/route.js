import mongoose from "mongoose"
import { ApiError, authenticate, requireRole, withApiErrors } from "@/lib/auth"
import { ContactEmail } from "@/lib/models/ContactEmail"

export const POST = withApiErrors(async (request, { params }) => {
  const { id } = await params
  const { user } = await authenticate(request)
  requireRole(user, ["administrator", "owner"])
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Not found")
  await ContactEmail.updateOne({ _id: id }, { read: true })
  return new Response(null, { status: 204 })
})
