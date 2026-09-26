import crypto from "node:crypto"

// Email/password signups are held back from Firebase until the visitor
// proves they own the address. The signup form's password is encrypted with
// a random one-off key; the ciphertext goes into Mongo (PendingSignup) and
// the key goes only into the emailed link, as `<pendingId>.<key>`. Opening
// the link hands both halves back to the server, which decrypts the password
// and only then creates the Firebase account.

const ALGORITHM = "aes-256-gcm"

export function encryptPassword(password) {
  const key = crypto.randomBytes(32)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(password, "utf8"), cipher.final()])
  return {
    key: key.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  }
}

// Throws if the key is wrong or anything was tampered with (GCM auth tag).
export function decryptPassword({ key, iv, tag, ciphertext }) {
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key, "base64url"), Buffer.from(iv, "base64url"))
  decipher.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8")
}

export function hashKey(key) {
  return crypto.createHash("sha256").update(String(key)).digest("hex")
}

export function keyMatches(key, keyHash) {
  if (!keyHash) return false
  const a = Buffer.from(hashKey(key), "hex")
  const b = Buffer.from(keyHash, "hex")
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export function buildToken(pendingId, key) {
  return `${pendingId}.${key}`
}

export function parseToken(token) {
  const match = /^([a-f0-9]{24})\.([A-Za-z0-9_-]{43})$/.exec(String(token || ""))
  return match ? { pendingId: match[1], key: match[2] } : null
}

// Firebase Auth's public REST API — the same endpoints the browser SDK calls,
// authorised by the (public) web API key, so no service account is needed.
// The Referer header keeps it working if the key is restricted to the site's
// own domain in Google Cloud.
async function identityToolkit(method, body, origin) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(origin ? { Referer: `${origin}/` } : {}) },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Firebase request failed (${res.status})`)
    err.firebaseCode = String(data?.error?.message || "").split(" ")[0]
    throw err
  }
  return data
}

export async function createFirebaseUser({ email, password, name, origin }) {
  const { localId, idToken } = await identityToolkit("signUp", { email, password, returnSecureToken: true }, origin)
  if (name) {
    try {
      await identityToolkit("update", { idToken, displayName: name, returnSecureToken: false }, origin)
    } catch (err) {
      // The account exists either way; the name is also kept in Mongo.
      console.error("Failed to set Firebase display name:", err.message)
    }
  }
  return { uid: localId }
}
