import { NextResponse } from "next/server"
import optimized from "./lib/optimizedAssets.json"

// Serves the WebP copy of a large /assets image (see scripts/optimizeImages.mjs)
// to browsers that accept WebP — same URL, same markup, same CMS data; ~90%
// fewer bytes. Browsers without WebP keep getting the original file.
const OPTIMIZED = new Set(optimized)

export function middleware(request) {
  const name = request.nextUrl.pathname.slice("/assets/".length)
  if (!OPTIMIZED.has(name)) return NextResponse.next()
  if (!(request.headers.get("accept") || "").includes("image/webp")) {
    const res = NextResponse.next()
    res.headers.set("Vary", "Accept")
    return res
  }
  const url = request.nextUrl.clone()
  url.pathname = `/assets/_webp/${name}.webp`
  const res = NextResponse.rewrite(url)
  res.headers.set("Vary", "Accept")
  return res
}

export const config = {
  matcher: ["/assets/:file((?!_webp/)[^/]+\\.(?:png|jpg|jpeg))"],
}
