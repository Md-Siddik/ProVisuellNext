import fs from "node:fs"
import fsp from "node:fs/promises"
import path from "node:path"
import { Readable } from "node:stream"

// Files already present in public/uploads are served by Next's static
// handler. In a production build that handler only knows about files that
// existed at startup, so anything uploaded afterwards (blog images and
// videos included) would 404 — this route serves those from the same folder.
const uploadsDir = path.join(process.cwd(), "public", "uploads")

const TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
}

const notFound = () => new Response("Not found", { status: 404 })

export async function GET(request, { params }) {
  const { path: segments } = await params
  // One bare filename only — no folders, no dot-files, nothing that can climb out of uploads/.
  if (!Array.isArray(segments) || segments.length !== 1) return notFound()
  const name = segments[0]
  if (!/^[A-Za-z0-9._-]+$/.test(name) || name.startsWith(".")) return notFound()

  const filePath = path.join(uploadsDir, name)
  let stat
  try {
    stat = await fsp.stat(filePath)
  } catch {
    return notFound()
  }
  if (!stat.isFile()) return notFound()

  const type = TYPES[path.extname(name).toLowerCase()]
  const headers = {
    "Content-Type": type || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    // An SVG opened directly must not be able to run script.
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    ...(type ? {} : { "Content-Disposition": "attachment" }),
  }

  // Byte ranges let a browser seek inside a video.
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") || "")
  if (range && (range[1] || range[2])) {
    let start = range[1] ? parseInt(range[1], 10) : stat.size - parseInt(range[2], 10)
    let end = range[1] && range[2] ? parseInt(range[2], 10) : stat.size - 1
    start = Math.max(0, start)
    end = Math.min(end, stat.size - 1)
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } })
    const stream = Readable.toWeb(fs.createReadStream(filePath, { start, end }))
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": String(end - start + 1) },
    })
  }

  return new Response(Readable.toWeb(fs.createReadStream(filePath)), {
    headers: { ...headers, "Content-Length": String(stat.size) },
  })
}
