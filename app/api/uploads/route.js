import { NextResponse } from "next/server"
import { authenticate, withApiErrors, ApiError } from "@/lib/auth"
import { requirePermission } from "@/lib/access"
import { saveUploadedFile } from "@/lib/uploadStorage"

// Matches the old multer config: limits.fileSize 20MB, .array("files", 10).
const MAX_FILE_SIZE = 20 * 1024 * 1024
const MAX_FILES = 10

export const POST = withApiErrors(async (request) => {
  requirePermission(await authenticate(request), "orders.create")

  const formData = await request.formData()
  const files = formData.getAll("files").filter((f) => typeof f === "object" && typeof f.arrayBuffer === "function")
  if (files.length > MAX_FILES) throw new ApiError(400, `Too many files (max ${MAX_FILES})`)
  for (const f of files) {
    if (f.size > MAX_FILE_SIZE) throw new ApiError(400, `${f.name} exceeds the 20MB limit`)
  }

  const saved = await Promise.all(files.map((f) => saveUploadedFile(f)))
  return NextResponse.json({ files: saved }, { status: 201 })
})
