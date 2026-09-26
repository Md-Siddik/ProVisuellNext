import { NextResponse } from "next/server"
import { authenticate, withApiErrors, ApiError } from "@/lib/auth"
import { can } from "@/lib/access"
import { CustomerLocation } from "@/lib/models/CustomerLocation"
import { Order } from "@/lib/models/Order"

function isValidCoord(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

// A customer may optionally paste a Google Maps share link as a link-only
// fallback (never scraped, never a coordinate source) — this just checks it
// actually points at Google Maps before it's stored.
function isValidGoogleMapsUrl(url) {
  if (!url) return true
  try {
    const u = new URL(url)
    if (u.protocol !== "https:") return false
    const host = u.hostname.toLowerCase()
    if (host === "maps.app.goo.gl" || host === "goo.gl" || host === "maps.google.com") return true
    if (/^(www\.)?google\.[a-z.]{2,24}$/.test(host) && u.pathname.startsWith("/maps")) return true
    return false
  } catch {
    return false
  }
}

// The order's own customer, or staff allowed to see precise customer locations.
async function loadOwnedOrder(auth, orderId, { allowStaff = true } = {}) {
  const order = await Order.findById(orderId)
  if (!order) throw new ApiError(404, "Order not found")
  const own = String(order.customerId) === String(auth.user._id)
  if (!own && !(allowStaff && can(auth, "customers.viewLocation"))) {
    throw new ApiError(403, "Not your order")
  }
  return order
}

// Customer: share (or re-share) their current location for one of their own
// orders. Upsert on `order` — sharing again just updates the existing row.
// Name/email always come from the authenticated user's own profile, never
// from the request body.
export const PUT = withApiErrors(async (request, { params }) => {
  const { orderId } = await params
  const auth = await authenticate(request)
  const { user } = auth
  // Only the order's own customer can share a location for it.
  const order = await loadOwnedOrder(auth, orderId, { allowStaff: false }).catch(() => {
    throw new ApiError(403, "Only a customer can share their own order's location")
  })

  const { lat, lng, locationAccuracy, locatedAt, googleMapsShareUrl } = (await request.json().catch(() => ({}))) || {}
  const latNum = Number(lat)
  const lngNum = Number(lng)
  if (!isValidCoord(latNum, lngNum)) {
    throw new ApiError(400, "A valid lat/lng is required")
  }
  if (!isValidGoogleMapsUrl(googleMapsShareUrl)) {
    throw new ApiError(400, "That doesn't look like a Google Maps link")
  }

  // The GPS reading's own timestamp, when the client has one — falls back
  // to "now" rather than null so a client that can't provide it still gets
  // a sensible display value.
  const locatedAtDate = new Date(locatedAt)
  const locatedAtValue = Number.isFinite(locatedAtDate.getTime()) ? locatedAtDate : new Date()

  const location = await CustomerLocation.findOneAndUpdate(
    { order: order._id },
    {
      customer: user._id,
      customerName: user.name || user.email,
      customerEmail: user.email || "",
      order: order._id,
      lat: latNum,
      lng: lngNum,
      locationAccuracy: Number.isFinite(Number(locationAccuracy)) ? Number(locationAccuracy) : null,
      locatedAt: locatedAtValue,
      source: "current_location",
      googleMapsShareUrl: String(googleMapsShareUrl || "").slice(0, 500),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  return NextResponse.json({ location })
})

// Fetch the saved location for one order — the customer may only read their
// own order's location; staff may read any (needed for the "open full
// order" link from the staff list to work both ways).
export const GET = withApiErrors(async (request, { params }) => {
  const { orderId } = await params
  const auth = await authenticate(request)
  const order = await loadOwnedOrder(auth, orderId)

  const location = await CustomerLocation.findOne({ order: order._id })
  return NextResponse.json({ location: location || null })
})
