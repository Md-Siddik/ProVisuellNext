import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"

// Private file storage for internal files (note attachments, voice notes).
// Unlike lib/uploadStorage.js (public/uploads, served to anyone), these live
// OUTSIDE public/ and are only streamed by authenticated API routes. Stored
// names are random; the original file name is kept only as metadata.
// Configure the folder with PRIVATE_STORAGE_DIR (defaults to ./storage/private).
function baseDir() {
  return path.resolve(process.env.PRIVATE_STORAGE_DIR || path.join(process.cwd(), "storage", "private"))
}

function safePath(area, storedName) {
  if (!/^[a-z]+$/.test(area) || !/^[a-f0-9]{32}\.[a-z0-9]{1,8}$/.test(storedName)) throw new Error("Invalid stored file name")
  return path.join(baseDir(), area, storedName)
}

export async function savePrivateFile(area, buffer, extension) {
  const ext = String(extension || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin"
  const storedName = `${crypto.randomBytes(16).toString("hex")}.${ext}`
  const file = safePath(area, storedName)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, buffer, { flag: "wx" })
  return storedName
}

export async function readPrivateFile(area, storedName) {
  return fs.readFile(safePath(area, storedName))
}

export async function deletePrivateFile(area, storedName) {
  try {
    await fs.unlink(safePath(area, storedName))
  } catch (err) {
    if (err.code !== "ENOENT") throw err
  }
}
