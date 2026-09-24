import { auth } from "./firebaseClient"
import { localizeApiError } from "./i18n/apiErrorMessages"

// The backend now lives in this same Next.js app under /api, so calls are
// same-origin by default — no more separate VITE_API_URL Express host, and
// no CORS needed. NEXT_PUBLIC_API_URL is kept as an escape hatch only (e.g.
// pointing a preview deploy at another environment's API).
const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/$/, "")

async function request(path, { method = "GET", body, auth: needsAuth = true, isForm = false } = {}) {
  const headers = {}
  if (!isForm) headers["Content-Type"] = "application/json"

  if (needsAuth) {
    const user = auth.currentUser
    if (user) {
      const token = await user.getIdToken()
      headers.Authorization = `Bearer ${token}`
    }
  }

  const res = await fetch(`${API_ROOT}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    // no JSON body (e.g. 204)
  }

  if (!res.ok) {
    const rawMessage = data?.error || `Request failed (${res.status})`
    const err = new Error(localizeApiError(rawMessage))
    // A few callers pattern-match on the specific English/Norwegian text the
    // backend sent (e.g. "is this the booking-conflict error?") to branch UI
    // behavior — that check must run against the original, not the localized
    // message, so it keeps working regardless of the selected language.
    err.rawMessage = rawMessage
    err.code = data?.code || null
    err.status = res.status
    throw err
  }
  return data
}

export const api = {
  get: (path) => request(path),
  post: (path, body, opts) => request(path, { method: "POST", body, ...opts }),
  put: (path, body) => request(path, { method: "PUT", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
  postForm: (path, formData) => request(path, { method: "POST", body: formData, isForm: true }),
  public: {
    get: (path) => request(path, { auth: false }),
    post: (path, body) => request(path, { method: "POST", body, auth: false }),
  },
}
