import fs from "node:fs/promises"
import path from "node:path"

// Local-disk storage, serving straight out of the Next.js `public/` folder
// (the same "/uploads/<file>" URL shape express.static used to produce).
// Kept behind this one function so a future cloud-storage adapter only has
// to change what's here, not every route that accepts an upload.
const uploadsDir = path.join(process.cwd(), "public", "uploads")

function sanitizeFilename(name) {
  return String(name || "file").replace(/[^a-zA-Z0-9._-]/g, "_")
}

// Writes one uploaded File (from a parsed FormData) to public/uploads and
// returns the same {fileName, url, size} shape the old multer-based routes
// returned. `prefix` mirrors each route's own filename convention ("" for
// /api/uploads, "site_" for the CMS media uploader).
export async function saveUploadedFile(file, prefix = "") {
  await fs.mkdir(uploadsDir, { recursive: true })
  const safe = sanitizeFilename(file.name)
  const filename = `${prefix}${Date.now()}_${safe}`
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(path.join(uploadsDir, filename), buffer)
  return { fileName: file.name, url: `/uploads/${filename}`, size: file.size }
}
