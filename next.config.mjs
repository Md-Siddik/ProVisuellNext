/** @type {import('next').NextConfig} */
const nextConfig = {
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
