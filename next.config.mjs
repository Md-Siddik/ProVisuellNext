/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build output folder. Defaults to .next; set NEXT_DIST_DIR (e.g. .next-e2e)
  // to build/test without touching the folder a running `next dev` uses.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The existing app renders plain <img> tags everywhere (CMS-uploaded
  // images, hero art, etc.) — keep that exact behavior instead of switching
  // to next/image, which would change loading/sizing behavior.
  images: {
    unoptimized: true,
  },
  // Uploaded files are served from /uploads (same convention as the
  // Express app's `express.static("uploads")`) via a route handler.
  async headers() {
    return []
  },
}

export default nextConfig
