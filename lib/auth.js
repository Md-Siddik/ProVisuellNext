import jwt from "jsonwebtoken"
import jwksClient from "jwks-rsa"
import { NextResponse } from "next/server"
import { connectDB } from "./db.js"
import { User } from "./models/User.js"
import { ApiError } from "./apiError.js"
import { BANNED_MESSAGE, findProfileByUid, resolveNewIdentity } from "./accountIdentity.js"
import { DeletedUser } from "./models/DeletedUser.js"
import { buildAccess, resolveSuperAdmin } from "./access.js"
import { getRolePermissionConfig } from "./rolePermissions.js"

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

export function roleForEmail(email) {
  return PRODUCTION_ROLES[String(email || "").toLowerCase()] || null
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

// Lives in its own module so framework-free code (lib/appointments) can
// throw it too; re-exported here for every existing import.
export { ApiError }

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

  // Email/password accounts must have a confirmed address. Signups made
  // through /api/auth/signup are confirmed by our own emailed link (Firebase
  // itself still reports them unverified), which marks the Mongo profile —
  // so either proof counts. No profile is ever created for an unconfirmed one.
  const unconfirmedPassword = decoded.firebase?.sign_in_provider === "password" && !decoded.email_verified

  // Every API request passes through here — a plain read for the usual case
  // (the identity already has a profile, its own or linked).
  let user = await findProfileByUid(decoded.sub)
  if (!user) {
    // First time this Firebase identity is seen (or its profile was
    // deleted): banned → refused; same verified email as an existing profile
    // → linked to it; otherwise a brand-new profile (lib/accountIdentity.js).
    user = await resolveNewIdentity(decoded, {
      create: async () => {
        // An unconfirmed email/password identity gets no profile — unless it
        // had one before that was deleted: it proved the address then (no
        // profile is ever created without that), so signing in again simply
        // starts a brand-new, confirmed customer profile.
        const deletedBefore = Boolean(await DeletedUser.exists({ firebaseUid: decoded.sub }))
        const confirmedBefore = unconfirmedPassword && deletedBefore
        if (unconfirmedPassword && !confirmedBefore) throw new ApiError(403, "Email not verified")
        const email = decoded.email || ""
        // A re-created profile is always a plain customer: no staff role comes
        // back automatically (not even the production bootstrap role).
        const role = deletedBefore ? null : roleForEmail(email)
        // Atomic find-or-create — two requests for the same brand-new user
        // arriving close together must not both insert and collide on the
        // unique firebaseUid index.
        return User.findOneAndUpdate(
          { firebaseUid: decoded.sub },
          {
            $setOnInsert: {
              firebaseUid: decoded.sub,
              email,
              name: decoded.name || "",
              ...(role ? { role } : {}),
              ...(confirmedBefore ? { emailVerified: true } : {}),
            },
          },
          { upsert: true, new: true }
        )
      },
    })
  }
  // (A banned profile is reported as banned by withAccess, not as unverified.)
  if (unconfirmedPassword && !user.emailVerified && user.status !== "banned") throw new ApiError(403, "Email not verified")
  return withAccess(user, decoded)
}

// Adds `access` — effective role + permissions (lib/access.js) — resolved
// from the verified identity and the database on every request, so a
// permission or status change applies on the very next call.
async function withAccess(user, decoded) {
  const [isSuperAdmin, roleConfig] = await Promise.all([resolveSuperAdmin(decoded, user), getRolePermissionConfig()])
  // A banned account is refused everywhere, whatever its role. The Super
  // Admin can't be banned through the app (lib/superadmin.js) and is exempt
  // here too, so a hand-edited document can never lock them out.
  if (user.status === "banned" && !isSuperAdmin) throw new ApiError(403, BANNED_MESSAGE, "ACCOUNT_BANNED")
  return { user, firebaseUser: decoded, access: buildAccess(user, isSuperAdmin, roleConfig) }
}

// Same thing under the name the permission utilities use.
export const verifyAuthenticatedUser = authenticate

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
      const code = err instanceof ApiError && err.code ? err.code : null
      // `error` stays the field every existing client reads; coded errors
      // also carry { success, code, message }.
      return NextResponse.json(code ? { success: false, code, message, error: message } : { error: message }, { status })
    }
  }
}
