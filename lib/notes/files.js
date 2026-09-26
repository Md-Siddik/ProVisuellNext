import { ApiError } from "../apiError.js"

// What a note may carry. The type is decided from the extension AND checked
// against the file's first bytes, so a renamed executable can't pass as a
// PDF. Served back with our own Content-Type, never the browser's claim.
export const MAX_FILE_BYTES = 10 * 1024 * 1024

const starts = (buf, bytes, offset = 0) => bytes.every((b, i) => buf[offset + i] === b)
const ascii = (buf, text, offset = 0) => starts(buf, [...Buffer.from(text, "ascii")], offset)
const isZip = (b) => starts(b, [0x50, 0x4b, 0x03, 0x04])
const isText = (b) => !b.subarray(0, 4096).includes(0)

const FILE_TYPES = {
  png: { mime: "image/png", check: (b) => starts(b, [0x89, 0x50, 0x4e, 0x47]), inline: true },
  jpg: { mime: "image/jpeg", check: (b) => starts(b, [0xff, 0xd8, 0xff]), inline: true },
  jpeg: { mime: "image/jpeg", check: (b) => starts(b, [0xff, 0xd8, 0xff]), inline: true },
  gif: { mime: "image/gif", check: (b) => ascii(b, "GIF8"), inline: true },
  webp: { mime: "image/webp", check: (b) => ascii(b, "RIFF") && ascii(b, "WEBP", 8), inline: true },
  pdf: { mime: "application/pdf", check: (b) => ascii(b, "%PDF-"), inline: true },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", check: isZip },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", check: isZip },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", check: isZip },
  txt: { mime: "text/plain; charset=utf-8", check: isText },
  csv: { mime: "text/csv; charset=utf-8", check: isText },
}

// MediaRecorder output (Chrome/Firefox: WebM/Opus or Ogg; Safari: MP4/AAC).
const VOICE_TYPES = {
  webm: { mime: "audio/webm", check: (b) => starts(b, [0x1a, 0x45, 0xdf, 0xa3]), inline: true },
  ogg: { mime: "audio/ogg", check: (b) => ascii(b, "OggS"), inline: true },
  m4a: { mime: "audio/mp4", check: (b) => ascii(b, "ftyp", 4), inline: true },
  mp4: { mime: "audio/mp4", check: (b) => ascii(b, "ftyp", 4), inline: true },
}

export function voiceExtensionFor(mimeType) {
  const m = String(mimeType || "").toLowerCase()
  if (m.includes("webm")) return "webm"
  if (m.includes("ogg")) return "ogg"
  if (m.includes("mp4") || m.includes("aac") || m.includes("m4a")) return "m4a"
  return null
}

// → { ext, mime } or throws a 400.
export function validateUpload(buffer, fileName, kind) {
  if (!buffer?.length) throw new ApiError(400, "The file is empty")
  if (buffer.length > MAX_FILE_BYTES) throw new ApiError(400, "Files can be at most 10 MB")
  const table = kind === "voice" ? VOICE_TYPES : FILE_TYPES
  const ext = String(fileName || "").toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1]
  const type = ext && table[ext]
  if (!type || !type.check(buffer)) throw new ApiError(400, "This file type isn't allowed")
  return { ext, mime: type.mime, inline: Boolean(type.inline) }
}

export function servingHeaders(file) {
  const ext = String(file.fileName).toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1]
  const type = (file.kind === "voice" ? VOICE_TYPES : FILE_TYPES)[ext]
  const safeName = String(file.fileName).replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "file"
  return {
    "Content-Type": type?.mime || "application/octet-stream",
    "Content-Disposition": `${type?.inline ? "inline" : "attachment"}; filename="${safeName}"`,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox",
    "Cache-Control": "private, no-store",
  }
}
