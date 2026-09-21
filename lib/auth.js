import jwt from "jsonwebtoken"
import jwksClient from "jwks-rsa"
import { NextResponse } from "next/server"
import { connectDB } from "./db.js"
import { User } from "./models/User.js"

// Ported from Server/src/middleware/verifyFirebaseToken.js and
// Server/src/middleware/requireRole.js. Express middleware calls next() down
// a chain; a Next.js Route Handler has no such chain, so the same checks are
// exposed here as plain functions each route calls directly, throwing an
// ApiError (caught by withApiErrors) instead of writing a response itself.

const projectId = process.env.FIREBASE_PROJECT_ID

// Production role bootstrap — these accounts get their real role the moment
// their Mongo User document is first created (whichever way they first sign
// in: email/password or Google), instead of the schema's "customer"
// default. Only applies at creation ($setOnInsert below); an account that
// already exists keeps whatever role it has — use `npm run set-role` to
// change an existing one.
const PRODUCTION_ROLES = {
  "siddik@provisuell.no": "administrator",
  "abusiddik9994@gmail.com": "administrator",
  "sergiu@provisuell.no": "owner",
  "info@provisuell.no": "administrator",
}

const client = jwksClient({
  jwksUri: "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  cache: true,
  cacheMaxAge: 12 * 60 * 60 * 1000,
})

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err)
    callback(null, key.getPublicKey())
  })
}

function verifyIdToken(idToken) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      idToken,
      getKey,
      {
        algorithms: ["RS256"],
        issuer: `https://securetoken.google.com/${projectId}`,
        audience: projectId,
      },
      (err, decoded) => {
        if (err) return reject(err)
        resolve(decoded)
      }
    )
  })
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// Verifies the Firebase ID token in the Authorization header, loads (or
// creates) the matching Mongo User document, and returns both. Every
// authenticated route handler calls this first.
export async function authenticate(request) {
  const header = request.headers.get("authorization") || ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : null
  if (!token) throw new ApiError(401, "Missing bearer token")

  let decoded
  try {
    decoded = await verifyIdToken(token)
  } catch (err) {
    console.error("Token verification failed:", err.message)
    throw new ApiError(401, "Invalid or expired token")
  }

  await connectDB()
  const email = decoded.email || ""
  const role = PRODUCTION_ROLES[email.toLowerCase()]
  // Atomic find-or-create — two requests for the same brand-new user
  // arriving close together (e.g. the frontend's auth sync firing alongside
  // other data fetches on first load) must not both try to insert and
  // collide on the unique firebaseUid index.
  const user = await User.findOneAndUpdate(
    { firebaseUid: decoded.sub },
    { $setOnInsert: { firebaseUid: decoded.sub, email, name: decoded.name || "", ...(role ? { role } : {}) } },
    { upsert: true, new: true }
  )
  return { user, firebaseUser: decoded }
}

export function requireRole(user, roles) {
  const allowed = Array.isArray(roles) ? roles : [roles]
  if (!user || !allowed.includes(user.role)) {
    throw new ApiError(403, "Not allowed for your role")
  }
}

// Wraps a Route Handler so a thrown ApiError (or any unexpected error)
// becomes the same JSON error shape Server/src/index.js's centralized
// handler produced — a deliberate 4xx passes its message through, a genuine
// 5xx never leaks internal details to the client.
export function withApiErrors(handler) {
  return async (request, ctx) => {
    try {
      return await handler(request, ctx)
    } catch (err) {
      const status = err instanceof ApiError ? err.status : err?.status || 500
      const message = status < 500 ? err.message : "Internal server error"
      if (status >= 500) console.error(err)
      return NextResponse.json({ error: message }, { status })
    }
  }
}
