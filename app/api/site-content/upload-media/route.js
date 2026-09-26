import { NextResponse } from "next/server"
import { authenticate, withApiErrors, ApiError } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { saveUploadedFile } from "@/lib/uploadStorage"

// Matches the old multer config: 80MB limit (covers hero-style background
// video too), image/video mimetypes only.
const MAX_FILE_SIZE = 80 * 1024 * 1024

export const POST = withApiErrors(async (request) => {
  requirePermission(await authenticate(request), "cms.edit")

  const formData = await request.formData()
  const file = formData.get("file")
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new ApiError(400, "No file uploaded")
  }
  if (!/^(image|video)\//.test(file.type)) {
    throw new ApiError(400, "Only image or video files are allowed")
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new ApiError(400, "File exceeds the 80MB limit")
  }

  const saved = await saveUploadedFile(file, "site_")
  return NextResponse.json({ url: saved.url }, { status: 201 })
})
